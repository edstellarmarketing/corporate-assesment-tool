/**
 * email-service.js — Send emails via Google Apps Script web app
 *
 * Usage:
 *   const emailService = new EmailService(webAppUrl);
 *   await emailService.sendOtp(email, name, otp, assessmentTitle, assessmentLink, dueDate);
 *   await emailService.sendResults(email, name, assessmentTitle, score, totalPoints, passingScore, passed, questionResults);
 */

class EmailService {
  constructor(webAppUrl) {
    this.webAppUrl = webAppUrl;
  }

  async send(to, subject, html) {
    try {
      const res = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ to, subject, html })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Email send failed');
      return true;
    } catch (err) {
      console.error('Email send error:', err);
      throw err;
    }
  }

  // ============ OTP EMAIL ============
  async sendOtp(to, participantName, otpCode, assessmentTitle, assessmentLink, dueDate) {
    const subject = 'Your Assessment Access Code — ' + assessmentTitle;
    const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
      <div style="background:#0e1a2b;padding:28px 32px;">
        <img src="https://edstellar.com/web-assets/images/edstellar-logo.svg" alt="Edstellar" style="height:22px;" />
      </div>
      <div style="padding:32px;">
        <h2 style="font-size:20px;color:#0e1a2b;margin:0 0 8px;">Assessment Assigned</h2>
        <p style="font-size:14px;color:#555;margin:0 0 24px;line-height:1.6;">
          Hi ${participantName},<br>
          You have been assigned a new assessment. Use the access code below to begin.
        </p>
        <div style="background:#f8f7f4;border:1px solid #e5e2db;padding:20px;text-align:center;margin-bottom:24px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:8px;">Assessment</div>
          <div style="font-size:16px;font-weight:600;color:#0e1a2b;margin-bottom:16px;">${assessmentTitle}</div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:8px;">Your Access Code</div>
          <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#0e1a2b;background:#fff;border:2px solid #0e1a2b;padding:16px;display:inline-block;">${otpCode}</div>
          ${dueDate ? '<div style="margin-top:16px;font-size:12px;color:#888;">Due by: <strong style="color:#0e1a2b;">' + dueDate + '</strong></div>' : ''}
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${assessmentLink}" style="display:inline-block;background:#0e1a2b;color:#ffffff;text-decoration:none;padding:14px 32px;font-size:14px;font-weight:600;letter-spacing:0.04em;">
            Open Assessment &rarr;
          </a>
        </div>
        <div style="font-size:12px;color:#999;line-height:1.5;">
          <strong>Instructions:</strong><br>
          1. Click the button above to open the assessment page<br>
          2. Enter the 6-digit access code shown above<br>
          3. The timer will start once you enter the code<br>
          4. Ensure a stable internet connection before starting
        </div>
      </div>
      <div style="background:#f8f7f4;padding:16px 32px;font-size:11px;color:#aaa;border-top:1px solid #e5e2db;">
        Sent by Edstellar Assessment Platform &middot; Do not share your access code
      </div>
    </div>`;
    return this.send(to, subject, html);
  }

  // ============ RESULTS EMAIL ============
  async sendResults(to, participantName, assessmentTitle, score, totalPoints, passingScore, passed, questionResults, feedback) {
    const pct = totalPoints > 0 ? Math.round(score / totalPoints * 100) : 0;
    const statusColor = passed ? '#16a34a' : '#dc2626';
    const statusText = passed ? 'PASSED' : 'NOT PASSED';

    let questionsHtml = '';
    if (questionResults && questionResults.length > 0) {
      questionResults.forEach((q, i) => {
        const isCorrect = q.is_correct;
        const icon = isCorrect ? '&#10003;' : '&#10007;';
        const color = isCorrect ? '#16a34a' : '#dc2626';
        const bg = isCorrect ? '#f0fdf4' : '#fef2f2';
        questionsHtml += `
        <div style="border:1px solid #e5e2db;margin-bottom:8px;padding:14px 16px;background:${bg};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:28px;vertical-align:top;font-size:18px;color:${color};">${icon}</td>
              <td style="vertical-align:top;">
                <div style="font-size:13px;color:#0e1a2b;font-weight:500;margin-bottom:4px;">Q${i + 1}. ${(q.prompt || '').substring(0, 120)}${(q.prompt || '').length > 120 ? '...' : ''}</div>
                <div style="font-size:12px;color:#666;margin-bottom:2px;">
                  <strong>Your answer:</strong> ${(q.user_answer || 'Not answered').substring(0, 150)}${(q.user_answer || '').length > 150 ? '...' : ''}
                </div>
                ${q.correct_answer ? '<div style="font-size:12px;color:#16a34a;"><strong>Correct answer:</strong> ' + q.correct_answer + '</div>' : ''}
                <div style="font-size:11px;color:#888;margin-top:4px;">
                  Points: ${q.points_earned || 0} / ${q.max_points || 0}
                  ${q.type === 'mcq' ? ' &middot; MCQ' : q.type === 'scenario' ? ' &middot; Scenario' : ' &middot; Coding'}
                </div>
              </td>
            </tr>
          </table>
        </div>`;
      });
    }

    const subject = 'Assessment Results — ' + assessmentTitle;
    const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;">
      <div style="background:#0e1a2b;padding:28px 32px;">
        <img src="https://edstellar.com/web-assets/images/edstellar-logo.svg" alt="Edstellar" style="height:22px;" />
      </div>
      <div style="padding:32px;">
        <h2 style="font-size:20px;color:#0e1a2b;margin:0 0 8px;">Assessment Results</h2>
        <p style="font-size:14px;color:#555;margin:0 0 24px;">Hi ${participantName}, here are your results for <strong>${assessmentTitle}</strong>.</p>

        <div style="background:#f8f7f4;border:1px solid #e5e2db;padding:24px;margin-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:4px;">Score</div>
                <div style="font-size:28px;font-weight:700;color:#0e1a2b;">${score} / ${totalPoints}</div>
                <div style="font-size:13px;color:#666;">${pct}% (Passing: ${passingScore}%)</div>
              </td>
              <td style="vertical-align:middle;text-align:right;">
                <div style="display:inline-block;padding:10px 24px;background:${statusColor};color:#fff;font-size:14px;font-weight:700;letter-spacing:0.06em;">
                  ${statusText}
                </div>
              </td>
            </tr>
          </table>
        </div>

        ${feedback ? '<div style="margin-bottom:24px;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;font-size:13px;color:#1e40af;line-height:1.6;"><strong>AI Feedback:</strong><br>' + feedback + '</div>' : ''}

        ${questionsHtml ? '<h3 style="font-size:14px;color:#0e1a2b;margin:0 0 12px;">Question-by-Question Breakdown</h3>' + questionsHtml : ''}
      </div>
      <div style="background:#f8f7f4;padding:16px 32px;font-size:11px;color:#aaa;border-top:1px solid #e5e2db;">
        Sent by Edstellar Assessment Platform
      </div>
    </div>`;
    return this.send(to, subject, html);
  }
}
