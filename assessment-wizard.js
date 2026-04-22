/**
 * assessment-wizard.js — Assessment Creation Wizard
 * Triggered by the +Assessment button in admin_dashboard.html
 */

(function () {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================
  const wiz = {
    step: 1,
    scope: null,          // 'individual' | 'group'
    groupSize: null,
    questionCount: 0,
    currentQuestionIndex: 0,
    questions: [],        // array of question objects
    title: '',
    passingScore: 60,
    timeLimitMinutes: null,
    instructions: '',
    invites: [],          // [{email, name}]
    assessmentId: null,
    _questionIds: [],
    saving: false,
  };

  const STEPS = [
    { num: 1, label: 'Scope' },
    { num: 2, label: 'Count' },
    { num: 3, label: 'Questions' },
    { num: 4, label: 'Details' },
    { num: 5, label: 'Invite' },
    { num: 6, label: 'Done' },
  ];

  // ============================================================
  // OPEN / CLOSE
  // ============================================================
  window.openAssessWizard = function () {
    Object.assign(wiz, {
      step: 1, scope: null, groupSize: null, questionCount: 0,
      currentQuestionIndex: 0, questions: [], title: '', passingScore: 60,
      timeLimitMinutes: null, instructions: '', invites: [],
      assessmentId: null, _questionIds: [], saving: false,
    });
    renderWizard();
    document.getElementById('assessWizardModal').classList.add('visible');
  };

  window.closeAssessWizard = function () {
    if (wiz.step > 1 && wiz.step < 6) {
      if (!confirm('Discard this assessment? All progress will be lost.')) return;
    }
    document.getElementById('assessWizardModal').classList.remove('visible');
  };

  // ============================================================
  // RENDER ORCHESTRATOR
  // ============================================================
  function renderWizard() {
    renderStepBar();
    renderStepContent();
    renderFooter();
  }

  function renderStepBar() {
    const bar = document.getElementById('wizStepBar');
    bar.innerHTML = STEPS.map(s => {
      let cls = 'wiz-step';
      if (s.num < wiz.step) cls += ' done';
      else if (s.num === wiz.step) cls += ' active';
      const label = (s.num === 3 && wiz.questionCount > 0)
        ? 'Q ' + (wiz.currentQuestionIndex + 1) + '/' + wiz.questionCount
        : s.label;
      return '<div class="' + cls + '">' +
        '<div class="wiz-step-num">' + (s.num < wiz.step ? '✓' : s.num) + '</div>' +
        '<div class="wiz-step-label">' + label + '</div>' +
        '</div>' +
        (s.num < STEPS.length ? '<div class="wiz-step-line' + (s.num < wiz.step ? ' done' : '') + '"></div>' : '');
    }).join('');
  }

  function renderStepContent() {
    const body = document.getElementById('wizBody');
    switch (wiz.step) {
      case 1: body.innerHTML = renderStep1(); break;
      case 2: body.innerHTML = renderStep2(); break;
      case 3: body.innerHTML = renderStep3(); break;
      case 4: body.innerHTML = renderStep4(); break;
      case 5: body.innerHTML = renderStep5(); break;
      case 6: body.innerHTML = renderStep6(); break;
    }
  }

  function renderFooter() {
    const footer = document.getElementById('wizFooter');
    if (wiz.step === 6) {
      footer.innerHTML = '<button class="btn btn-primary btn-sm" onclick="closeAssessWizard()">Close</button>';
      return;
    }
    const isFirst = wiz.step === 1;
    let primaryLabel = 'Next →';
    if (wiz.step === 3) primaryLabel = wiz.currentQuestionIndex < wiz.questionCount - 1 ? 'Next Question →' : 'Continue →';
    if (wiz.step === 4) primaryLabel = 'Continue to Invite →';
    if (wiz.step === 5) primaryLabel = 'Send Invites & Publish →';

    footer.innerHTML =
      '<button class="btn btn-ghost btn-sm" onclick="' + (isFirst ? 'closeAssessWizard()' : 'wizPrev()') + '">' +
        (isFirst ? 'Cancel' : '← Back') +
      '</button>' +
      '<button class="btn btn-primary btn-sm" id="wizNextBtn" onclick="wizNext()">' + primaryLabel + '</button>';
  }

  // ============================================================
  // STEP 1 — SCOPE
  // ============================================================
  function renderStep1() {
    return '<div>' +
      '<h3 class="wiz-h">Who is this assessment for?</h3>' +
      '<p class="wiz-sub">Choose whether you\'re evaluating one person or comparing a group.</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        scopeCard('individual', '👤', 'Individual', 'Evaluate a single person. Full report shared privately between admin and participant.') +
        scopeCard('group', '👥', 'Group', 'Compare multiple people. Admin sees a full leaderboard + AI comparison. Each participant receives only their own results.') +
      '</div>' +
      (wiz.scope === 'group' ?
        '<div style="margin-top:18px;">' +
          '<label class="form-label">How many participants? <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:var(--ink-faint);">(planning hint — you can add more or fewer at the invite step)</span></label>' +
          '<input type="number" class="form-input" id="groupSizeInput" min="2" max="200" value="' + (wiz.groupSize || '') + '" placeholder="e.g. 5" style="max-width:140px;" oninput="wiz_setGroupSize(this.value)">' +
        '</div>' : '') +
    '</div>';
  }

  function scopeCard(value, icon, title, desc) {
    const sel = wiz.scope === value;
    return '<div class="wiz-scope-card' + (sel ? ' selected' : '') + '" onclick="wiz_setScope(\'' + value + '\')">' +
      '<div style="font-size:30px;margin-bottom:10px;">' + icon + '</div>' +
      '<div style="font-size:14px;font-weight:600;color:var(--ink);margin-bottom:6px;">' + title + '</div>' +
      '<div style="font-size:11.5px;color:var(--ink-mute);line-height:1.5;">' + desc + '</div>' +
    '</div>';
  }

  window.wiz_setScope = function (val) {
    wiz.scope = val;
    if (val === 'individual') wiz.groupSize = null;
    renderWizard();
  };
  window.wiz_setGroupSize = function (val) {
    wiz.groupSize = parseInt(val) || null;
  };

  // ============================================================
  // STEP 2 — QUESTION COUNT
  // ============================================================
  function renderStep2() {
    const est = Math.max(wiz.questionCount || 1, 1) * 2;
    return '<div>' +
      '<h3 class="wiz-h">How many questions?</h3>' +
      '<p class="wiz-sub">You\'ll build each question one at a time in the next step.</p>' +
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">' +
        '<input type="number" class="form-input" id="qCountInput" min="1" max="50" value="' + (wiz.questionCount || '') + '" placeholder="e.g. 5"' +
          ' style="max-width:120px;font-size:22px;font-family:\'Fraunces\',serif;text-align:center;"' +
          ' oninput="wiz.questionCount=parseInt(this.value)||0;document.getElementById(\'estTime\').textContent=\'~\'+(Math.max(wiz.questionCount,1)*2)+\' min per participant\'">' +
        '<span style="font-size:13px;color:var(--ink-mute);">questions</span>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">' +
        [1,3,5,8,10,15,20].map(n =>
          '<button class="btn btn-ghost btn-sm" onclick="wiz_setQCount(' + n + ')">' + n + '</button>'
        ).join('') +
      '</div>' +
      '<p id="estTime" style="font-size:11px;color:var(--ink-faint);">~' + est + ' min per participant</p>' +
    '</div>';
  }

  window.wiz_setQCount = function (n) {
    wiz.questionCount = n;
    const inp = document.getElementById('qCountInput');
    if (inp) inp.value = n;
    const est = document.getElementById('estTime');
    if (est) est.textContent = '~' + (n * 2) + ' min per participant';
  };

  // ============================================================
  // STEP 3 — QUESTION BUILDER
  // ============================================================
  function renderStep3() {
    const idx = wiz.currentQuestionIndex;
    const q = wiz.questions[idx] || initQuestion();

    const dots = Array.from({ length: wiz.questionCount }, (_, i) => {
      let cls = 'wiz-q-dot';
      if (i < idx) cls += ' done';
      else if (i === idx) cls += ' active';
      return '<div class="' + cls + '" onclick="wiz_jumpToQ(' + i + ')" title="Q' + (i + 1) + '"></div>';
    }).join('');

    let typeSpecific = '';
    if (q.type === 'mcq') typeSpecific = renderMcqOptions(q, idx);
    else if (q.type === 'code') typeSpecific = renderCodeOptions(q, idx);
    else if (q.type === 'long_text_attachment') typeSpecific = renderAttachmentNote();

    return '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">' +
        '<h3 class="wiz-h" style="margin-bottom:0;">Question ' + (idx + 1) + ' <span style="color:var(--ink-faint);font-size:13px;font-family:\'Inter Tight\',sans-serif;">of ' + wiz.questionCount + '</span></h3>' +
        '<div style="display:flex;gap:5px;align-items:center;">' + dots + '</div>' +
      '</div>' +

      // type selector
      '<label class="form-label">Question type</label>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;">' +
        qTypeTile(q, 'text', 'Aa', 'Short Text') +
        qTypeTile(q, 'mcq', '☑', 'MCQ') +
        qTypeTile(q, 'long_text_attachment', '📎', 'Long + File') +
        qTypeTile(q, 'code', '</>', 'Code') +
      '</div>' +

      // prompt
      '<div class="form-group">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<label class="form-label" style="margin-bottom:0;">Question prompt</label>' +
          '<button class="btn btn-ghost btn-sm" id="aiEnhanceBtn_' + idx + '" onclick="wizAiEnhance(' + idx + ')" style="font-size:10px;padding:4px 10px;gap:5px;">' +
            '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>' +
            'AI Enhance' +
          '</button>' +
        '</div>' +
        '<textarea class="form-input" id="qPrompt_' + idx + '" rows="3" placeholder="Enter your question here — rough draft is fine, AI can refine it..." style="resize:vertical;font-family:inherit;line-height:1.55;">' + esc(q.prompt) + '</textarea>' +
        (q.aiEnhanced && q.originalPrompt
          ? '<div style="margin-top:5px;"><button class="btn btn-ghost btn-sm" onclick="wizRevertPrompt(' + idx + ')" style="font-size:10px;padding:3px 8px;color:var(--warn);">↩ Revert to original</button></div>'
          : '') +
      '</div>' +

      typeSpecific +

      // max points
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<label class="form-label" style="margin-bottom:0;white-space:nowrap;">Max points:</label>' +
        '<input type="number" class="form-input" id="qMaxPts_' + idx + '" min="1" max="100" value="' + (q.maxPoints || 10) + '" style="max-width:90px;">' +
      '</div>' +
    '</div>';
  }

  function initQuestion() {
    return { type: null, prompt: '', originalPrompt: null, options: defaultMcqOptions(), maxPoints: 10, language: 'javascript', starterCode: '', aiEnhanced: false };
  }

  function qTypeTile(q, type, icon, label) {
    const sel = q.type === type;
    return '<div class="wiz-q-type' + (sel ? ' selected' : '') + '" onclick="wiz_setQType(' + wiz.currentQuestionIndex + ',\'' + type + '\')">' +
      '<div style="font-size:16px;margin-bottom:4px;">' + icon + '</div>' +
      '<div style="font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">' + label + '</div>' +
    '</div>';
  }

  function renderMcqOptions(q, idx) {
    const opts = q.options || defaultMcqOptions();
    return '<div class="form-group">' +
      '<label class="form-label">Answer options <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:var(--ink-faint);">— tick the correct one</span></label>' +
      opts.map((opt, oi) =>
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
          '<input type="radio" name="mcqCorrect_' + idx + '" value="' + oi + '"' + (opt.isCorrect ? ' checked' : '') + ' onchange="wiz_mcqCorrect(' + idx + ',' + oi + ')">' +
          '<span style="font-size:11px;font-weight:700;color:var(--ink-mute);width:16px;">' + ['A','B','C','D'][oi] + '</span>' +
          '<input type="text" class="form-input" id="mcqOpt_' + idx + '_' + oi + '" value="' + esc(opt.text) + '" placeholder="Option ' + ['A','B','C','D'][oi] + '" style="flex:1;">' +
        '</div>'
      ).join('') +
    '</div>';
  }

  function renderCodeOptions(q, idx) {
    const langs = ['javascript','python','sql','java','typescript','go','rust','cpp','csharp','kotlin'];
    return '<div class="form-group">' +
      '<label class="form-label">Programming language</label>' +
      '<select class="form-select" id="codeLang_' + idx + '" style="max-width:180px;margin-bottom:14px;">' +
        langs.map(l => '<option value="' + l + '"' + (q.language === l ? ' selected' : '') + '>' + l + '</option>').join('') +
      '</select>' +
      '<label class="form-label">Starter code <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:var(--ink-faint);">— optional skeleton shown to participant</span></label>' +
      '<textarea class="form-input" id="codeStarter_' + idx + '" rows="4" placeholder="// Write starter code here..." style="font-family:\'JetBrains Mono\',monospace;font-size:12px;resize:vertical;">' + esc(q.starterCode || '') + '</textarea>' +
    '</div>';
  }

  function renderAttachmentNote() {
    return '<div style="padding:12px 14px;background:var(--edstellar-mist);border:1px solid #c5d5f5;font-size:12px;color:var(--edstellar);margin-bottom:16px;">' +
      'Participant will write a long-form answer and can optionally attach a file (PDF, image, doc).' +
    '</div>';
  }

  function defaultMcqOptions() {
    return [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ];
  }

  window.wiz_setQType = function (idx, type) {
    saveCurrentQuestion();
    const q = wiz.questions[idx] || initQuestion();
    q.type = type;
    if (type === 'mcq' && (!q.options || q.options.length === 0)) q.options = defaultMcqOptions();
    wiz.questions[idx] = q;
    renderWizard();
  };

  window.wiz_mcqCorrect = function (idx, optIdx) {
    const q = wiz.questions[idx];
    if (!q || !q.options) return;
    q.options.forEach((o, i) => { o.isCorrect = i === optIdx; });
  };

  window.wiz_jumpToQ = function (idx) {
    saveCurrentQuestion();
    wiz.currentQuestionIndex = idx;
    renderWizard();
  };

  // ============================================================
  // STEP 4 — TITLE + SETTINGS
  // ============================================================
  function renderStep4() {
    const timeOpts = [null, 15, 30, 45, 60, 90, 120];
    return '<div>' +
      '<h3 class="wiz-h">Name &amp; settings</h3>' +
      '<p class="wiz-sub">Give your assessment a title and configure pass criteria.</p>' +

      '<div class="form-group">' +
        '<label class="form-label">Assessment title <span style="color:var(--accent);">*</span></label>' +
        '<input type="text" class="form-input" id="wizTitleInput" value="' + esc(wiz.title) + '" placeholder="e.g. Prompt Engineering Challenge — Q2 2026" style="font-size:15px;">' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
        '<div class="form-group">' +
          '<label class="form-label">Passing score</label>' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<input type="range" id="passingScoreRange" min="0" max="100" value="' + wiz.passingScore + '" style="flex:1;" oninput="document.getElementById(\'psVal\').textContent=this.value+\'%\';wiz.passingScore=parseInt(this.value);">' +
            '<span id="psVal" style="font-family:\'JetBrains Mono\',monospace;font-size:14px;font-weight:600;min-width:38px;">' + wiz.passingScore + '%</span>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Time limit</label>' +
          '<select class="form-select" id="timeLimitSelect">' +
            timeOpts.map(v =>
              '<option value="' + (v || '') + '"' + (wiz.timeLimitMinutes === v ? ' selected' : '') + '>' + (v ? v + ' minutes' : 'No limit') + '</option>'
            ).join('') +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">Instructions for participants <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:var(--ink-faint);">— shown on the start screen</span></label>' +
        '<textarea class="form-input" id="wizInstructions" rows="3" placeholder="Any rules, context, or guidance for participants..." style="resize:vertical;font-family:inherit;line-height:1.5;">' + esc(wiz.instructions) + '</textarea>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // STEP 5 — INVITE
  // ============================================================
  function renderStep5() {
    const isSingle = wiz.scope === 'individual';
    const targetCount = isSingle ? 1 : (wiz.groupSize || 1);

    // Initialise or resize the invites array to exactly targetCount rows
    if (wiz.invites.length === 0) {
      wiz.invites = Array.from({ length: targetCount }, () => ({ email: '', name: '' }));
    } else if (wiz.invites.length < targetCount) {
      while (wiz.invites.length < targetCount) wiz.invites.push({ email: '', name: '' });
    } else if (wiz.invites.length > targetCount) {
      wiz.invites.length = targetCount;
    }

    const filled  = wiz.invites.filter(i => i.email).length;
    const counter = '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--ink-mute);">' +
      filled + ' / ' + targetCount + ' filled</span>';

    return '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">' +
        '<h3 class="wiz-h" style="margin-bottom:0;">Invite participants</h3>' +
        counter +
      '</div>' +
      '<p class="wiz-sub">' +
        (isSingle
          ? 'Enter the email address of the person being assessed.'
          : targetCount + ' fields shown — one per participant you selected in Step 1.') +
      '</p>' +

      '<div id="inviteRows">' + buildInviteRows() + '</div>' +

      '<div style="margin-top:16px;padding:12px 14px;background:var(--edstellar-mist);border:1px solid #c5d5f5;font-size:12px;color:var(--edstellar);line-height:1.55;">' +
        '<strong>What happens next:</strong> Each participant gets an email with a unique assessment link and a 6-digit access code. The timer starts when they enter their code.' +
      '</div>' +
    '</div>';
  }

  function buildInviteRows() {
    return wiz.invites.map((inv, i) =>
      '<div class="wiz-invite-row" id="invRow_' + i + '">' +
        '<span style="font-size:10px;font-weight:700;color:var(--ink-faint);min-width:22px;text-align:right;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<input type="text" class="form-input" placeholder="Name (optional)" value="' + esc(inv.name) + '" oninput="wiz.invites[' + i + '].name=this.value" style="flex:0.7;">' +
        '<input type="email" class="form-input" placeholder="email@company.com *" value="' + esc(inv.email) + '" oninput="wiz.invites[' + i + '].email=this.value;wizUpdateInviteCounter()" style="flex:1;">' +
      '</div>'
    ).join('');
  }

  window.wizUpdateInviteCounter = function () {
    const targetCount = wiz.scope === 'individual' ? 1 : (wiz.groupSize || 1);
    const filled = wiz.invites.filter(i => i.email).length;
    const counter = document.querySelector('#inviteRows + div + div span, #wizBody span[style*="JetBrains"]');
    // Re-render only the counter text without touching the inputs
    const allSpans = document.querySelectorAll('#wizBody span');
    allSpans.forEach(s => {
      if (s.textContent.includes('/ ' + targetCount + ' filled')) {
        s.textContent = filled + ' / ' + targetCount + ' filled';
      }
    });
  };

  function syncInviteRows() {
    wiz.invites.forEach((inv, i) => {
      const nameEl = document.querySelector('#invRow_' + i + ' input[placeholder="Name (optional)"]');
      const emailEl = document.querySelector('#invRow_' + i + ' input[type="email"]');
      if (nameEl) inv.name = nameEl.value;
      if (emailEl) inv.email = emailEl.value;
    });
  }

  // ============================================================
  // STEP 6 — CONFIRMATION
  // ============================================================
  function renderStep6() {
    const sent = wiz.invites.filter(i => i.email).length;
    return '<div style="text-align:center;padding:24px 0 12px;">' +
      '<div style="font-size:52px;margin-bottom:16px;">✅</div>' +
      '<h3 style="font-family:\'Fraunces\',serif;font-size:22px;font-weight:500;color:var(--ink);margin-bottom:8px;">Assessment created!</h3>' +
      '<p style="font-size:13px;color:var(--ink-mute);margin-bottom:24px;line-height:1.6;">' +
        '<strong>' + esc(wiz.title) + '</strong> has been published and <strong>' + sent + '</strong> participant' + (sent !== 1 ? 's have' : ' has') + ' been notified by email.' +
      '</p>' +
      '<div style="background:var(--paper-warm);border:1px solid var(--rule);padding:20px 24px;text-align:left;max-width:360px;margin:0 auto 20px;">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:12px;">' +
          sumRow('Questions', wiz.questionCount) +
          sumRow('Scope', wiz.scope.charAt(0).toUpperCase() + wiz.scope.slice(1)) +
          sumRow('Passing score', wiz.passingScore + '%') +
          sumRow('Time limit', wiz.timeLimitMinutes ? wiz.timeLimitMinutes + ' min' : 'None') +
          sumRow('Invites sent', sent) +
        '</div>' +
      '</div>' +
      '<p style="font-size:11.5px;color:var(--ink-mute);">You\'ll see a notification here when participants complete the assessment.</p>' +
    '</div>';
  }

  function sumRow(label, value) {
    return '<div style="color:var(--ink-mute);">' + label + '</div><div style="font-weight:600;color:var(--ink);">' + value + '</div>';
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  window.wizNext = async function () {
    const btn = document.getElementById('wizNextBtn');
    if (!btn || btn.disabled) return;

    // --- Validate & advance ---
    if (wiz.step === 1) {
      if (!wiz.scope) { showToast('Select who this assessment is for', 'warn'); return; }
      if (wiz.scope === 'group') {
        const inp = document.getElementById('groupSizeInput');
        if (inp) wiz.groupSize = parseInt(inp.value) || null;
        if (!wiz.groupSize || wiz.groupSize < 2) { showToast('Enter a group size (minimum 2)', 'warn'); return; }
      }
    }

    if (wiz.step === 2) {
      const inp = document.getElementById('qCountInput');
      if (inp) wiz.questionCount = parseInt(inp.value) || 0;
      if (wiz.questionCount < 1) { showToast('Enter at least 1 question', 'warn'); return; }
      // Init questions array to the right length
      while (wiz.questions.length < wiz.questionCount) wiz.questions.push(initQuestion());
      wiz.questions.length = wiz.questionCount;
      wiz.currentQuestionIndex = 0;
    }

    if (wiz.step === 3) {
      saveCurrentQuestion();
      const q = wiz.questions[wiz.currentQuestionIndex];
      if (!q.type) { showToast('Select a question type', 'warn'); return; }
      if (!q.prompt.trim()) { showToast('Enter the question prompt', 'warn'); return; }
      if (q.type === 'mcq') {
        const filled = (q.options || []).filter(o => o.text.trim()).length;
        const hasCorrect = (q.options || []).some(o => o.isCorrect && o.text.trim());
        if (filled < 2) { showToast('Add at least 2 MCQ options', 'warn'); return; }
        if (!hasCorrect) { showToast('Mark at least one correct MCQ option', 'warn'); return; }
      }
      // More questions remaining — advance within step 3
      if (wiz.currentQuestionIndex < wiz.questionCount - 1) {
        wiz.currentQuestionIndex++;
        renderWizard();
        return;
      }
      // All done — fall through to step++
    }

    if (wiz.step === 4) {
      saveStep4();
      if (!wiz.title.trim()) { showToast('Enter a title for the assessment', 'warn'); return; }
    }

    if (wiz.step === 5) {
      syncInviteRows();
      const valid = wiz.invites.filter(i => i.email && i.email.includes('@'));
      if (valid.length === 0) { showToast('Add at least one valid email address', 'warn'); return; }
      wiz.invites = valid;

      btn.disabled = true;
      btn.textContent = 'Publishing...';
      try {
        await doSaveToDb();
        await doSendInvites();
        wiz.step = 6;
        renderWizard();
        if (typeof loadAssessments === 'function') loadAssessments();
        if (typeof loadStats === 'function') loadStats();
        if (typeof setupCompletionBanner === 'function') setupCompletionBanner();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Send Invites & Publish →';
      }
      return;
    }

    wiz.step++;
    renderWizard();
  };

  window.wizPrev = function () {
    if (wiz.step === 3 && wiz.currentQuestionIndex > 0) {
      saveCurrentQuestion();
      wiz.currentQuestionIndex--;
      renderWizard();
      return;
    }
    if (wiz.step > 1) {
      wiz.step--;
      renderWizard();
    }
  };

  // ============================================================
  // SAVE HELPERS
  // ============================================================
  function saveCurrentQuestion() {
    const idx = wiz.currentQuestionIndex;
    const q = wiz.questions[idx] || initQuestion();

    const pEl = document.getElementById('qPrompt_' + idx);
    if (pEl) q.prompt = pEl.value;

    const mEl = document.getElementById('qMaxPts_' + idx);
    if (mEl) q.maxPoints = parseInt(mEl.value) || 10;

    if (q.type === 'mcq') {
      (q.options || defaultMcqOptions()).forEach((opt, oi) => {
        const tEl = document.getElementById('mcqOpt_' + idx + '_' + oi);
        if (tEl) opt.text = tEl.value;
        const rEl = document.querySelector('input[name="mcqCorrect_' + idx + '"][value="' + oi + '"]');
        opt.isCorrect = rEl ? rEl.checked : false;
      });
    }

    if (q.type === 'code') {
      const lEl = document.getElementById('codeLang_' + idx);
      if (lEl) q.language = lEl.value;
      const sEl = document.getElementById('codeStarter_' + idx);
      if (sEl) q.starterCode = sEl.value;
    }

    wiz.questions[idx] = q;
  }

  function saveStep4() {
    const tEl = document.getElementById('wizTitleInput');
    if (tEl) wiz.title = tEl.value.trim();
    const rEl = document.getElementById('passingScoreRange');
    if (rEl) wiz.passingScore = parseInt(rEl.value) || 60;
    const lEl = document.getElementById('timeLimitSelect');
    if (lEl) wiz.timeLimitMinutes = parseInt(lEl.value) || null;
    const iEl = document.getElementById('wizInstructions');
    if (iEl) wiz.instructions = iEl.value;
  }

  // ============================================================
  // SAVE TO DATABASE
  // ============================================================
  async function doSaveToDb() {
    const sb = getClient();
    const orgId = await getOrgId();
    const current = await getCurrentUser();

    const totalPts = wiz.questions.reduce((s, q) => s + (q.maxPoints || 10), 0);

    const { data: assessData, error: assessErr } = await sb
      .from('v2-assessments')
      .insert({
        org_id: orgId,
        title: wiz.title,
        scope: wiz.scope,
        group_size: wiz.groupSize,
        total_questions: wiz.questionCount,
        total_points: totalPts,
        passing_score: wiz.passingScore,
        time_limit_minutes: wiz.timeLimitMinutes,
        instructions: wiz.instructions,
        status: 'published',
        created_by: current?.profile?.id || null,
      })
      .select('id')
      .single();

    if (assessErr) throw new Error('Could not create assessment: ' + assessErr.message);
    wiz.assessmentId = assessData.id;

    const qRows = wiz.questions.map((q, i) => ({
      assessment_id: wiz.assessmentId,
      order_index: i + 1,
      type: q.type,
      prompt: q.prompt,
      options: q.type === 'mcq' ? q.options : null,
      correct_answer: q.type === 'mcq' ? ((q.options || []).find(o => o.isCorrect)?.text || null) : null,
      max_points: q.maxPoints,
      language: q.type === 'code' ? q.language : null,
      starter_code: q.type === 'code' ? q.starterCode : null,
      ai_enhanced: q.aiEnhanced || false,
    }));

    const { data: qData, error: qErr } = await sb
      .from('v2-assessment-questions')
      .insert(qRows)
      .select('id');

    if (qErr) throw new Error('Could not save questions: ' + qErr.message);
    wiz._questionIds = (qData || []).map(q => q.id);
  }

  // ============================================================
  // SEND INVITES
  // ============================================================
  async function doSendInvites() {
    const sb = getClient();
    const orgId = await getOrgId();

    // Fallback chain: Supabase v2-settings → Vercel env var → hardcoded default
    const HARDCODED_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzS2fUP8m6TMccSJZnMMRRbqvSuY0NZO5Dxy3_16SWl29wWXBrrqaVwPzF_AvZZCXRT/exec';

    const { data: settingsRows } = await sb.from('v2-settings').select('key, value').eq('org_id', orgId);
    let dbUrl = '';
    (settingsRows || []).forEach(row => {
      let val = row.value;
      if (typeof val === 'string') { try { val = JSON.parse(val); } catch (e) {} }
      if (row.key === 'email_webapp_url') dbUrl = val;
    });

    const webAppUrl = dbUrl
      || (window.env && window.env.GOOGLE_WEBAPP_URL)
      || HARDCODED_WEBAPP_URL;

    const emailSvc = new EmailService(webAppUrl);

    const baseUrl = window.location.origin;
    const assessLink = baseUrl + '/Participant%20Live%20Assessment.html';

    for (const inv of wiz.invites) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const token = makeToken();

      const { error: invErr } = await sb.from('v2-assessment-invites').insert({
        assessment_id: wiz.assessmentId,
        org_id: orgId,
        email: inv.email,
        name: inv.name || '',
        otp,
        link_token: token,
        status: 'invited',
      });

      if (invErr) {
        console.warn('Invite insert failed for ' + inv.email + ':', invErr.message);
        continue;
      }

      if (emailSvc) {
        const link = assessLink + '?token=' + token;
        const displayName = inv.name || inv.email.split('@')[0];
        try {
          await emailSvc.sendOtp(inv.email, displayName, otp, wiz.title, link, null);
        } catch (e) {
          console.warn('Email failed for ' + inv.email + ':', e.message);
        }
      }
    }
  }

  function makeToken() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ============================================================
  // AI ENHANCE
  // ============================================================
  window.wizAiEnhance = async function (idx) {
    saveCurrentQuestion();
    const q = wiz.questions[idx];
    if (!q) return;

    const promptEl = document.getElementById('qPrompt_' + idx);
    if (promptEl) q.prompt = promptEl.value;
    if (!q.prompt.trim()) { showToast('Enter a question prompt first', 'warn'); return; }

    const btn = document.getElementById('aiEnhanceBtn_' + idx);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:sb-spin 1s linear infinite;"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Enhancing...';
    }

    try {
      const result = await aiEnhanceQuestion(q.prompt, q.type);
      if (result && result.enhanced_prompt) {
        q.originalPrompt = q.prompt;
        q.prompt = result.enhanced_prompt;
        q.aiEnhanced = true;
        wiz.questions[idx] = q;
        if (promptEl) promptEl.value = result.enhanced_prompt;
        // Show revert link if not already there
        const wrap = promptEl ? promptEl.parentElement : null;
        if (wrap && !wrap.querySelector('.ai-revert')) {
          const d = document.createElement('div');
          d.className = 'ai-revert';
          d.style.marginTop = '5px';
          d.innerHTML = '<button class="btn btn-ghost btn-sm" onclick="wizRevertPrompt(' + idx + ')" style="font-size:10px;padding:3px 8px;color:var(--warn);">↩ Revert to original</button>';
          wrap.appendChild(d);
        }
        showToast('Question enhanced by AI', 'success');
      }
    } catch (err) {
      showToast('AI Enhance failed: ' + err.message, 'error');
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg> AI Enhance';
    }
  };

  window.wizRevertPrompt = function (idx) {
    const q = wiz.questions[idx];
    if (!q || !q.originalPrompt) return;
    const promptEl = document.getElementById('qPrompt_' + idx);
    if (promptEl) promptEl.value = q.originalPrompt;
    q.prompt = q.originalPrompt;
    q.aiEnhanced = false;
    q.originalPrompt = null;
    wiz.questions[idx] = q;
    renderWizard();
    showToast('Reverted to original prompt', 'info');
  };

  // ============================================================
  // UTILITY
  // ============================================================
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Expose globally — inline oninput handlers in rendered HTML reference window.wiz
  window.wiz = wiz;

})();
