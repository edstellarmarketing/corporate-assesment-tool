/**
 * ai-grading.js — Client-side AI grading via OpenRouter API
 *
 * Reads the OpenRouter API key from v2-settings and calls the API directly.
 * No edge function required.
 *
 * Usage:
 *   const result = await aiGradeScenario(responseText, rubricCriteria);
 *   const result = await aiGradeCode(codeText, testResults);
 *   const result = await aiGenerateNotes(rubricScores, responseText);
 */

let _aiConfigCache = null;

/**
 * Fetch OpenRouter API key and model settings from v2-settings.
 */
async function _getAiConfig() {
  if (_aiConfigCache) return _aiConfigCache;

  const sb = getClient();
  if (!sb) throw new Error('Supabase client not configured');

  const orgId = await getOrgId();
  if (!orgId) throw new Error('No organization found');

  const { data } = await sb.from('v2-settings').select('key, value').eq('org_id', orgId);
  if (!data) throw new Error('Could not load settings');

  const config = {};
  data.forEach(row => {
    let val = row.value;
    if (typeof val === 'string') { try { val = JSON.parse(val); } catch(e) {} }
    config[row.key] = val;
  });

  const openrouterKey = config.openrouterKey || config.openrouter_key;
  if (!openrouterKey) throw new Error('OpenRouter API key not configured. Go to Settings to add it.');

  const defaultModel = config.defaultModel || config.default_model || 'anthropic/claude-sonnet-4';

  _aiConfigCache = {
    apiKey: openrouterKey,
    defaultModel,
    routeGrading: config.routeGrading || config.route_grading || defaultModel,
    routeCode: config.routeCode || config.route_code || defaultModel,
    routeNotes: config.routeNotes || config.route_notes || defaultModel,
    routeQuestions: config.routeQuestions || config.route_questions || defaultModel,
    routeFallback: config.routeFallback || config.route_fallback || 'anthropic/claude-haiku-4',
    temperature: parseFloat(config.temperature || '0.3'),
    maxTokens: parseInt(config.maxTokensGrading || config.max_tokens_grading || '2048')
  };

  // Clear cache after 5 minutes so settings changes take effect
  setTimeout(() => { _aiConfigCache = null; }, 300000);

  return _aiConfigCache;
}

/**
 * Call OpenRouter API directly.
 * @param {string} model - Model ID
 * @param {string} systemPrompt - System message
 * @param {string} userPrompt - User message
 * @param {number} maxTokens - Max output tokens
 * @returns {Object} Parsed JSON response
 */
async function _callOpenRouter(model, systemPrompt, userPrompt, maxTokens) {
  const config = await _getAiConfig();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + config.apiKey,
      'Content-Type': 'application/json',
      'X-Title': 'Edstellar Assessment Platform'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: config.temperature,
      max_tokens: maxTokens || config.maxTokens,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    // Try fallback model
    console.warn('Primary model failed (' + model + '), trying fallback:', errText.substring(0, 100));
    const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
        'X-Title': 'Edstellar Assessment Platform'
      },
      body: JSON.stringify({
        model: config.routeFallback,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: config.temperature,
        max_tokens: maxTokens || config.maxTokens,
        response_format: { type: 'json_object' }
      })
    });

    if (!fallbackRes.ok) {
      const fallbackErr = await fallbackRes.text();
      throw new Error('Both primary and fallback models failed: ' + fallbackErr.substring(0, 200));
    }

    const fallbackData = await fallbackRes.json();
    const fallbackText = fallbackData.choices?.[0]?.message?.content || '{}';
    try { return JSON.parse(fallbackText); } catch(e) { return { raw: fallbackText }; }
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(content); } catch(e) { return { raw: content }; }
}

/**
 * AI-grade a scenario/essay response.
 */
async function aiGradeScenario(responseText, rubricCriteria) {
  const config = await _getAiConfig();
  const systemPrompt = `You are an expert assessment grader. Evaluate the response against the provided rubric criteria. For each criterion, provide a score (integer) and brief justification. Also provide overall performance notes. Respond in JSON format:
{
  "criteria_scores": [{"name": "...", "score": N, "max": N, "justification": "..."}],
  "total_score": N,
  "total_max": N,
  "performance_notes": "..."
}`;
  const userPrompt = `Rubric Criteria:\n${JSON.stringify(rubricCriteria, null, 2)}\n\nEmployee Response:\n${responseText}`;
  return _callOpenRouter(config.routeGrading, systemPrompt, userPrompt);
}

/**
 * AI-grade a coding submission.
 */
async function aiGradeCode(codeText, testResults) {
  const config = await _getAiConfig();
  const systemPrompt = `You are an expert code reviewer. Evaluate the submitted code based on test results and code quality. Provide a score, feedback on correctness, style, and efficiency. Respond in JSON format:
{
  "score": N,
  "max_score": N,
  "feedback": "...",
  "correctness": "...",
  "style_notes": "...",
  "efficiency_notes": "..."
}`;
  const userPrompt = `Code Submission:\n${codeText}\n\nTest Results:\n${JSON.stringify(testResults, null, 2)}`;
  return _callOpenRouter(config.routeCode, systemPrompt, userPrompt);
}

/**
 * Generate performance notes from rubric scores.
 */
async function aiGenerateNotes(rubricScores, responseText) {
  const config = await _getAiConfig();
  const systemPrompt = `You are an assessment performance analyst. Given the rubric scores, generate a concise narrative performance summary (2-3 paragraphs) highlighting strengths, areas for improvement, and actionable recommendations. Respond in JSON format:
{
  "performance_notes": "..."
}`;
  const userPrompt = `Rubric Scores:\n${JSON.stringify(rubricScores, null, 2)}\n\nEmployee Response:\n${responseText || 'N/A'}`;
  return _callOpenRouter(config.routeNotes, systemPrompt, userPrompt);
}
