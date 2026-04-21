/**
 * edge-cases.js — Shared utilities for edge cases and polish
 *
 * Include after supabase-client.js on any page that needs these features.
 */

/**
 * Check and mark overdue assignments.
 * Call on admin dashboard load.
 */
async function checkOverdueAssignments() {
  const sb = getClient();
  if (!sb) return;

  const today = new Date().toISOString().split('T')[0];
  const { error } = await sb
    .from('v2-assignments')
    .update({ status: 'overdue' })
    .eq('status', 'assigned')
    .lt('due_date', today);

  if (error) console.warn('[edge-cases] Overdue check failed:', error.message);
}

/**
 * Auto-generate a certificate after grading completes.
 * Call after a grading submission when final_score is known.
 */
async function autoGenerateCertificate(sessionId) {
  const sb = getClient();
  if (!sb) return;

  // Load the session with related data
  const { data: session } = await sb
    .from('v2-sessions')
    .select('*, "v2-users"(*, "v2-departments"(name)), "v2-assessments"(*, "v2-programmes"(name))')
    .eq('id', sessionId)
    .single();

  if (!session) return;

  const user = session['v2-users'];
  const assess = session['v2-assessments'];
  const programme = assess?.['v2-programmes'];
  const dept = user?.['v2-departments'];

  // Get org for passing threshold
  const { data: org } = await sb
    .from('v2-organizations')
    .select('*')
    .eq('id', user?.org_id)
    .single();

  const threshold = org?.passing_threshold || 70;
  const scorePercent = session.score_percentage || 0;

  if (scorePercent < threshold) return; // Below passing — no certificate

  // Check if certificate already exists
  const { data: existing } = await sb
    .from('v2-certificates')
    .select('id')
    .eq('session_id', sessionId)
    .single();

  if (existing) return; // Already issued

  // Generate verification code
  const initials = ((user?.first_name || '')[0] || '') + ((user?.last_name || '')[0] || '');
  const prefix = org?.certificate_prefix || 'CERT';
  const code = prefix + '-' + initials.toUpperCase() + '-' + (user?.employee_id || '').replace('EMP-', '') + '-' + Date.now().toString(36).toUpperCase();

  // Determine performance band
  let band = 'Pass';
  if (scorePercent >= 90) band = 'Exceeds Expectations';
  else if (scorePercent >= 80) band = 'Proficient';
  else if (scorePercent >= 70) band = 'Competent';

  const { error } = await sb.from('v2-certificates').insert({
    user_id: user?.id,
    org_id: user?.org_id,
    session_id: sessionId,
    assessment_name: assess?.title || '',
    programme_name: programme?.name || '',
    recipient_name: (user?.first_name || '') + ' ' + (user?.last_name || ''),
    job_title: user?.job_title || '',
    department: dept?.name || '',
    score_percentage: scorePercent,
    performance_band: band,
    verification_code: code,
    signatory_name: org?.signatory_name || '',
    signatory_title: org?.signatory_title || '',
    issued_at: new Date().toISOString()
  });

  if (error) {
    console.warn('[edge-cases] Certificate generation failed:', error.message);
  } else {
    console.log('[edge-cases] Certificate generated:', code);
  }
}

/**
 * Recompute competency scores for a user after grading.
 */
async function recomputeCompetencyScores(userId) {
  const sb = getClient();
  if (!sb) return;

  // Get all graded responses for this user grouped by competency
  const { data: responses } = await sb
    .from('v2-responses')
    .select('*, "v2-questions"(competency), "v2-sessions"!inner(user_id, status)')
    .eq('v2-sessions.user_id', userId)
    .eq('v2-sessions.status', 'graded')
    .not('final_score', 'is', null);

  if (!responses || responses.length === 0) return;

  // Group by competency
  const grouped = {};
  responses.forEach(r => {
    const competency = r['v2-questions']?.competency || 'General';
    if (!grouped[competency]) grouped[competency] = { total: 0, max: 0, count: 0 };
    grouped[competency].total += r.final_score || 0;
    grouped[competency].max += r.max_score || 0;
    grouped[competency].count += 1;
  });

  // Upsert competency scores
  const rows = Object.entries(grouped).map(([name, data]) => ({
    user_id: userId,
    competency: name,
    score: data.total,
    max_score: data.max,
    percentage: data.max > 0 ? Math.round((data.total / data.max) * 100) : 0,
    response_count: data.count,
    updated_at: new Date().toISOString()
  }));

  for (const row of rows) {
    await sb.from('v2-competency-scores').upsert(row, { onConflict: 'user_id,competency' });
  }
}

/**
 * Export data as CSV.
 * @param {Array} data - Array of objects
 * @param {string} filename - Filename for download
 * @param {Array} [columns] - Optional column keys to include
 */
function exportCSV(data, filename, columns) {
  if (!data || data.length === 0) {
    showToast('No data to export', 'warn');
    return;
  }

  const keys = columns || Object.keys(data[0]);
  const header = keys.join(',');
  const rows = data.map(row => {
    return keys.map(k => {
      let val = row[k];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val + '"';
      }
      return val;
    }).join(',');
  });

  const csv = header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'export.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('CSV exported: ' + filename, 'success');
}

/**
 * Session expiry handler — auto-submit when timer hits 0.
 * Call from the live assessment page timer.
 */
async function handleSessionExpiry(sessionId) {
  const sb = getClient();
  if (!sb) return;

  // Auto-submit the session
  await sb.from('v2-sessions').update({
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    time_remaining_sec: 0
  }).eq('id', sessionId);

  // Insert integrity summary
  await sb.from('v2-integrity-summary').insert({
    session_id: sessionId,
    auto_submitted: true,
    reason: 'Timer expired'
  });

  showToast('Time expired. Your assessment has been auto-submitted.', 'warn');

  // Redirect after brief delay
  setTimeout(() => {
    window.location.href = 'employee_dashboard.html';
  }, 2000);
}
