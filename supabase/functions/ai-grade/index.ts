// Supabase Edge Function: ai-grade
// Routes AI grading requests through OpenRouter, keeping the API key server-side.
//
// Deploy: supabase functions deploy ai-grade
// Call:   supabase.functions.invoke('ai-grade', { body: { ... } })

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase client with the user's JWT to verify their identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is admin
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: profile } = await serviceClient
      .from('v2-users')
      .select('role, org_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const orgId = profile.org_id

    // Parse request body
    const body = await req.json()
    const { task, response_text, rubric_criteria, code_text, test_results, rubric_scores, prompt: aiPrompt } = body

    // Get OpenRouter API key from v2-settings
    const { data: keyRow } = await serviceClient
      .from('v2-settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('key', 'openrouterKey')
      .single()

    if (!keyRow?.value) {
      return new Response(JSON.stringify({ error: 'OpenRouter API key not configured. Go to Settings to add it.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const openrouterKey = keyRow.value

    // Get model routing config
    const routeKey = task === 'grade_code' ? 'routeCode' : task === 'generate_notes' ? 'routeNotes' : task === 'generate_assessment' ? 'routeGrading' : 'routeGrading'
    const { data: routeRow } = await serviceClient
      .from('v2-settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('key', routeKey)
      .single()

    const { data: fallbackRow } = await serviceClient
      .from('v2-settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('key', 'routeFallback')
      .single()

    const { data: tempRow } = await serviceClient
      .from('v2-settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('key', 'temperature')
      .single()

    const { data: maxTokensRow } = await serviceClient
      .from('v2-settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('key', 'maxTokensGrading')
      .single()

    const model = routeRow?.value || 'anthropic/claude-sonnet-4'
    const fallbackModel = fallbackRow?.value || 'anthropic/claude-haiku-4'
    const temperature = parseFloat(tempRow?.value || '0.3')
    const maxTokens = task === 'generate_assessment' ? 8192 : parseInt(maxTokensRow?.value || '2048')

    // Build the prompt based on task type
    let systemPrompt = ''
    let userPrompt = ''

    if (task === 'grade_scenario' || task === 'grade_essay') {
      systemPrompt = `You are an expert assessment grader. Evaluate the response against the provided rubric criteria. For each criterion, provide a score (integer) and brief justification. Also provide overall performance notes. Respond in JSON format:
{
  "criteria_scores": [{"name": "...", "score": N, "max": N, "justification": "..."}],
  "total_score": N,
  "total_max": N,
  "performance_notes": "..."
}`
      userPrompt = `Rubric Criteria:\n${JSON.stringify(rubric_criteria, null, 2)}\n\nEmployee Response:\n${response_text}`
    } else if (task === 'grade_code') {
      systemPrompt = `You are an expert code reviewer. Evaluate the submitted code based on test results and code quality. Provide a score, feedback on correctness, style, and efficiency. Respond in JSON format:
{
  "score": N,
  "max_score": N,
  "feedback": "...",
  "correctness": "...",
  "style_notes": "...",
  "efficiency_notes": "..."
}`
      userPrompt = `Code Submission:\n${code_text}\n\nTest Results:\n${JSON.stringify(test_results, null, 2)}`
    } else if (task === 'generate_notes') {
      systemPrompt = `You are an assessment performance analyst. Given the rubric scores, generate a concise narrative performance summary (2-3 paragraphs) highlighting strengths, areas for improvement, and actionable recommendations. Respond in JSON format:
{
  "performance_notes": "..."
}`
      userPrompt = `Rubric Scores:\n${JSON.stringify(rubric_scores, null, 2)}\n\nEmployee Response:\n${response_text || 'N/A'}`
    } else if (task === 'generate_assessment') {
      systemPrompt = `You are an expert corporate training assessment designer. Generate comprehensive, professional assessments with well-structured questions. Always respond with valid JSON only — no markdown, no code fences, no extra text.`
      userPrompt = aiPrompt || ''
    } else {
      return new Response(JSON.stringify({ error: 'Invalid task type. Use: grade_scenario, grade_code, generate_notes, or generate_assessment' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Call OpenRouter with retry/fallback
    async function callOpenRouter(modelId: string) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': supabaseUrl,
          'X-Title': 'Edstellar Assessment Platform'
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' }
        })
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`OpenRouter ${res.status}: ${errText}`)
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content || '{}'
    }

    let result
    try {
      result = await callOpenRouter(model)
    } catch (primaryError) {
      console.warn('Primary model failed, trying fallback:', primaryError.message)
      try {
        result = await callOpenRouter(fallbackModel)
      } catch (fallbackError) {
        return new Response(JSON.stringify({
          error: 'Both primary and fallback models failed',
          primary_error: primaryError.message,
          fallback_error: fallbackError.message
        }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Parse the AI response
    let parsed
    try {
      parsed = JSON.parse(result)
    } catch {
      parsed = { raw: result }
    }

    return new Response(JSON.stringify({
      success: true,
      model_used: model,
      result: parsed
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
