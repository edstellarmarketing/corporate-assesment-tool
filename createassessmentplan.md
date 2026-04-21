# Assessment Creation — Full Flow Plan

## Overview

A multi-step wizard triggered by the **+Assessment** button in the admin topbar. The flow covers creation, inviting participants, live monitoring, AI-powered grading, and result distribution.

---

## Tech Stack Alignment

| Concern | Solution |
|---|---|
| Storage | Supabase (`Corporate-Assessment-Tool` schema) |
| Email | `EmailService` class via Google Apps Script web app |
| AI grading | `ai-grading.js` → OpenRouter API |
| Auth guard | `requireAdmin()` from `supabase-client.js` |
| UI | Inline modal wizard in `admin_dashboard.html` |
| Participant portal | `Participant Live Assessment.html` (existing) |

---

## Database Tables Required

### `v2-assessments`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto |
| `org_id` | uuid FK | from admin's org |
| `title` | text | set at final step |
| `scope` | text | `'individual'` or `'group'` |
| `group_size` | int | null if individual |
| `total_questions` | int | |
| `passing_score` | int | percentage, default 60 |
| `time_limit_minutes` | int | optional |
| `status` | text | `draft` → `active` → `closed` → `graded` |
| `created_by` | uuid FK | admin user id |
| `created_at` | timestamptz | |
| `graded_at` | timestamptz | |
| `notification_dismissed` | bool | default false |

### `v2-assessment-questions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `assessment_id` | uuid FK | |
| `order_index` | int | 1-based position |
| `type` | text | `text` \| `mcq` \| `long_text_attachment` \| `code` |
| `prompt` | text | the question text |
| `options` | jsonb | MCQ options array `[{label, value, is_correct}]` |
| `correct_answer` | text | for MCQ/text auto-grade |
| `max_points` | int | default 10 |
| `ai_enhanced` | bool | was AI used to polish the prompt |

### `v2-assessment-invites`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `assessment_id` | uuid FK | |
| `email` | text | invitee email |
| `name` | text | optional, used in email |
| `otp` | text | 6-digit code, generated on invite |
| `status` | text | `invited` → `started` → `submitted` |
| `invited_at` | timestamptz | |
| `started_at` | timestamptz | |
| `submitted_at` | timestamptz | |
| `link_token` | text | unique URL token |

### `v2-assessment-responses`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `invite_id` | uuid FK | |
| `assessment_id` | uuid FK | |
| `question_id` | uuid FK | |
| `answer_text` | text | for text/long/code |
| `answer_choice` | text | for MCQ (value) |
| `attachment_url` | text | for long_text_attachment |
| `submitted_at` | timestamptz | |

### `v2-assessment-results`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `invite_id` | uuid FK | |
| `assessment_id` | uuid FK | |
| `score` | int | |
| `total_points` | int | |
| `passed` | bool | |
| `ai_feedback` | text | narrative summary |
| `criteria_scores` | jsonb | per-question breakdown |
| `graded_at` | timestamptz | |
| `result_sent` | bool | default false |
| `result_sent_at` | timestamptz | |

---

## Wizard Steps (Modal UI)

The wizard is a full-screen overlay modal with a persistent progress bar at the top.

```
Step 1 → Step 2 → Step 3 (×N questions) → Step 4 → Step 5 → Step 6
 Scope    Count      Questions              Title    Invite   Confirm
```

---

### Step 1 — Scope Selection

**Question:** "Who is this assessment for?"

- **Individual** — evaluating a single person
- **Group** — evaluating multiple people

If **Group** is selected, show: `How many participants? [ ___ ]` (number input, min 2)

**UX Detail:** Large card-style radio buttons, not small inputs.

---

### Step 2 — Question Count

**Question:** "How many questions will this assessment have?"

- Dropdown or stepper: 1–50
- Show estimated time hint: `~2 min per question`

This number locks in Step 3's loop count.

---

### Step 3 — Question Builder (repeats N times)

Header: `Question X of Y`

Each question card has:

#### 3a. Question Type Selector
Four option tiles:

| Type | Icon | Description |
|---|---|---|
| `text` | T | Short text answer (1–3 lines) |
| `mcq` | ☑ | Multiple choice (4 options, one correct) |
| `long_text_attachment` | 📎 | Long answer + optional file upload |
| `code` | `</>` | Code editor with language selector |

#### 3b. Question Input
- Textarea: "Enter your question..." (rough input OK — AI will refine)
- **AI Enhance button** (wand icon): Calls `aiEnhanceQuestion(roughText, type)` via OpenRouter. Shows spinner. Replaces textarea content with enhanced version. Admin can revert to original.
- For `mcq` type: Show 4 option inputs + correct answer radio
- For `code` type: Show language selector (JS, Python, SQL, Java, etc.) + optional starter code block
- Points input: `Max points: [ 10 ]`

#### 3c. Navigation
- `← Previous` / `Next Question →` buttons
- Progress dots at bottom (filled = completed)
- Admin can jump back to any completed question to edit

---

### Step 4 — Assessment Title & Settings

- **Assessment Title**: text input (required)
- **Passing Score**: `[ 60 ]%` slider
- **Time Limit**: `[ None / 15 / 30 / 45 / 60 / 90 / 120 ] minutes`
- **Instructions for participants**: optional textarea shown on participant portal start screen

---

### Step 5 — Invite Participants

Display changes based on scope:

**Individual:** Single email input with optional name field.

**Group:** 
- Add emails one-by-one with `+ Add Another`
- OR paste comma-separated list
- Name field per email is optional
- Running count: `3 / 5 added` (if group_size was set in Step 1)
- Allow exceeding the original count (it was just a planning hint)

For each invite, the system:
1. Generates a unique 6-digit OTP
2. Generates a unique `link_token` (UUID)
3. Constructs assessment link: `https://<domain>/Participant Live Assessment.html?token=<link_token>`
4. Sends email via `EmailService.sendOtp()` with the above details

---

### Step 6 — Confirmation

Show summary card:
- Assessment title
- Number of questions, types used
- Number of invites sent
- Passing score, time limit
- `[ View Assessment ]` button → jumps to assessment detail in dashboard

Auto-save assessment to Supabase on reaching this step with `status = 'active'`.

---

## AI Question Enhancement

New function added to `ai-grading.js`:

```javascript
async function aiEnhanceQuestion(roughText, questionType) {
  // Calls routeQuestions model
  // System prompt: make the question clear, professional, unambiguous
  // Returns: { enhanced_prompt: "...", explanation: "..." }
}
```

The explanation is shown in a small tooltip so the admin understands what changed and why.

---

## Participant Experience

Flow in `Participant Live Assessment.html` (existing page, extend as needed):

1. Open link with `?token=<link_token>`
2. Enter OTP code → validates against `v2-assessment-invites`
3. Show instructions + timer starts
4. Questions shown one at a time, matching `order_index`
5. Code questions: in-browser Monaco or CodeMirror editor
6. File upload for `long_text_attachment` → upload to Supabase Storage bucket `assessment-attachments`
7. On submit: write all answers to `v2-assessment-responses`, set invite `status = 'submitted'`
8. Show: "Thank you. Your responses have been submitted." No score shown — admin grades first.

**Realtime tracking:** Supabase realtime subscription on `v2-assessment-invites` lets admin dashboard update live as status changes.

---

## Admin Notification (Completion Alert)

When **all** invites for an assessment reach `status = 'submitted'` (or admin manually triggers):

- Show a **prominent banner** at the top of `admin_dashboard.html`:

```
⚡ "Leadership Skills Q1 2025" — All 5 participants have completed. [ Grade Now ]
```

- Banner is persistent (not a toast) until admin clicks "Grade Now" or dismisses
- Stored in `v2-assessments.notification_dismissed` so it persists across page reloads
- Realtime: subscribe to `v2-assessment-invites` changes filtered by `assessment_id` to trigger banner update live

**Partial completion alert (optional enhancement):**
- Softer badge on the assessment row in the table: `3 / 5 submitted`
- Clicking it shows a participant status panel

---

## AI Grading Flow

Triggered when admin clicks "Grade Now" on the notification banner or from the assessment detail view.

### Per-participant grading:
1. Load all `v2-assessment-responses` for the invite
2. For each question:
   - `mcq` / `text` with `correct_answer`: auto-grade, 100% or 0%
   - `text` / `long_text_attachment` / `code`: call `aiGradeScenario()` or `aiGradeCode()` 
3. Sum scores, calculate percentage
4. Call `aiGenerateNotes()` for overall narrative
5. Write result to `v2-assessment-results`

### Batch grading:
- Grade all participants in sequence with a progress indicator
- Show: `Grading 3 / 5...`
- On complete: update assessment `status = 'graded'`, set `graded_at`

---

## Group Comparison Report (Admin-Only)

Available only for `scope = 'group'` assessments, after all participants are graded.

### Purpose
Lets admin compare all participants head-to-head and find the top performer — for example, "who wrote the best prompt?" — with an AI-generated explanation of why the winner won and where others fell short.

### Trigger
After grading completes, a **"View Group Report"** button appears in the assessment detail panel. This opens `admin_assessment_report.html` in group-comparison mode.

---

### Report Layout

#### Section 1 — Leaderboard

A ranked table sorted by total score descending:

| Rank | Participant | Score | % | Pass/Fail | Time Taken | Action |
|---|---|---|---|---|---|---|
| 🥇 1 | alice@corp.com | 92 / 100 | 92% | Passed | 18 min | View Detail |
| 🥈 2 | bob@corp.com | 85 / 100 | 85% | Passed | 24 min | View Detail |
| 🥉 3 | carol@corp.com | 61 / 100 | 61% | Passed | 31 min | View Detail |
| 4 | dan@corp.com | 38 / 100 | 38% | Not Passed | 42 min | View Detail |

- Rank 1 row is visually highlighted (gold left border or subtle gold background)
- Ties are broken by time taken (faster = higher rank)
- "View Detail" expands that participant's full per-question breakdown inline

#### Section 2 — AI Comparison Narrative

A dedicated `[ Generate Comparison Report ]` button calls a new AI function `aiCompareGroup()`.

**What it does:**
- Sends all participants' answers side-by-side for each question to the AI
- AI produces a structured narrative that includes:
  - **Overall winner declaration** with reason (e.g., "Alice ranked first due to superior prompt specificity and correct use of role-context in Q2 and Q3")
  - **Per-question winner** — who answered each question best and why
  - **Skill gap analysis** — common mistakes across the group (e.g., "3 of 4 participants missed the system prompt boundary in Q4")
  - **Standout moments** — a notable answer that was exceptionally good or creative
  - **Improvement recommendations** per participant (2–3 bullet points each)

**Output format (stored in `v2-assessment-results` as `group_comparison_report` jsonb on the assessment row, or a new `v2-assessment-group-reports` table):**

```json
{
  "winner_email": "alice@corp.com",
  "winner_reason": "Alice demonstrated the clearest understanding of...",
  "per_question": [
    {
      "question_index": 1,
      "winner_email": "alice@corp.com",
      "winner_reason": "...",
      "common_mistakes": "..."
    }
  ],
  "skill_gap_summary": "...",
  "standout_moment": { "email": "bob@corp.com", "question_index": 3, "note": "..." },
  "individual_recommendations": [
    { "email": "alice@corp.com", "recommendations": ["...", "..."] },
    { "email": "bob@corp.com", "recommendations": ["...", "..."] }
  ]
}
```

**UI rendering of the narrative:**
- Winner card at the top: name, score, trophy icon, winner reason paragraph
- Accordion sections per question showing who won each and why
- Skill gap summary box (amber background — it's a team-level insight)
- Each participant's recommendation bullets at the bottom

#### Section 3 — Question-by-Question Grid

A matrix view for quick scanning:

| Question | Alice | Bob | Carol | Dan |
|---|---|---|---|---|
| Q1: Describe... | 10/10 ✓ | 8/10 | 7/10 | 4/10 |
| Q2: Write a prompt... | 25/25 ✓ | 20/25 | 18/25 | 10/25 |
| Q3: Fix this code... | 15/20 | 18/20 ✓ | 12/20 | 9/20 |

- Green cell = highest score for that question
- Clicking a cell shows the participant's actual answer for that question in a side panel

#### Section 4 — Export Options

- **Export PDF** — full comparison report with leaderboard + AI narrative (uses `window.print()` with a print stylesheet, or a Supabase Edge Function for server-side PDF if needed)
- **Export CSV** — raw scores per participant per question
- **Copy Winner Summary** — copies a short text snippet to clipboard, e.g.:

```
Assessment: "Prompt Engineering Challenge — April 2026"
Winner: Alice (92%) — Best use of role-context and constraint specification.
Runner-up: Bob (85%) — Strong technically, room to improve on edge case coverage.
```

---

### New AI Function: `aiCompareGroup()`

Added to `ai-grading.js`:

```javascript
async function aiCompareGroup(assessmentTitle, questions, participantResults) {
  // participantResults: array of { email, name, answers: [{question_index, prompt, answer, score, max}] }
  // Uses routeGrading model (most capable)
  // Returns the structured JSON above
}
```

System prompt instructs the model to be specific, cite actual answer content when explaining why someone won a question, and avoid generic praise.

---

### New DB Column

Add `group_comparison_report` jsonb column to `v2-assessments` to cache the generated report so it doesn't need to be re-generated on every view:

```sql
ALTER TABLE "v2-assessments" ADD COLUMN group_comparison_report jsonb;
ALTER TABLE "v2-assessments" ADD COLUMN group_report_generated_at timestamptz;
```

Admin can click **"Regenerate"** to force a fresh AI analysis if they want.

---

## Result Distribution

After grading, admin sees a results panel with:

| Participant | Score | Status | Action |
|---|---|---|---|
| john@acme.com | 78% | Passed | Send Results |
| jane@acme.com | 45% | Not Passed | Send Results |

**Send Results** button calls `EmailService.sendResults()` with per-question breakdown and AI feedback.

**Send All** button sends to all participants in one click.

On send: sets `v2-assessment-results.result_sent = true` and `result_sent_at`.

### Scope-based visibility rules:
- **Individual assessment:** Full score + question breakdown emailed to participant
- **Group assessment:** Admin sees the full leaderboard + AI comparison report in the dashboard. Participants receive **only their own** score + AI feedback + personal improvement recommendations in email — no leaderboard, no comparison with others, no group report shared externally

---

## Assessment Detail View

Clicking an assessment row in the dashboard opens an inline panel (or new page `admin_assessment_report.html` extended) showing:

- Assessment metadata (title, dates, settings)
- Participant list with real-time status (`invited` / `started` / `submitted` / `graded`)
- Results table (after grading)
- "Reopen" button to allow re-attempts (sets invite `status = 'invited'`, new OTP)
- "Close Assessment" button (no new submissions accepted after this)
- Export to CSV (scores summary)

---

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `admin_dashboard.html` | Modify | Add wizard modal HTML + CSS |
| `assessment-wizard.js` | Create | Wizard state machine, all Step logic |
| `ai-grading.js` | Modify | Add `aiEnhanceQuestion()` + `aiCompareGroup()` |
| `email-service.js` | No change | Already has `sendOtp` and `sendResults` |
| `Participant Live Assessment.html` | Modify | Token-based login, submission handler |
| `create-assessment-tables.sql` | Create | All 5 new tables + group report columns |
| `admin_assessment_report.html` | Modify | Extended results view + group comparison report |

---

## SQL Migration Script (`create-assessment-tables.sql`)

To be run in Supabase SQL Editor after `create-core-tables.sql`:

- Creates all 5 tables in `Corporate-Assessment-Tool` schema
- Adds RLS: admins read/write all rows for their org; participants read only their own invite/response rows (by `link_token` match in session context)
- Creates indexes on `assessment_id`, `invite_id`, `org_id` for query performance

---

## Implementation Order

1. **SQL** — Run `create-assessment-tables.sql` to create tables (includes group report columns)
2. **Wizard UI** — Build modal in `admin_dashboard.html` + `assessment-wizard.js` (Steps 1–4 first, no email yet)
3. **Save to DB** — Wire Step 4 "Create" to insert into `v2-assessments` + `v2-assessment-questions`
4. **Invite flow** — Step 5 email sending via `EmailService`
5. **Participant portal** — Token login + submission in `Participant Live Assessment.html`
6. **Notifications** — Realtime banner in dashboard
7. **AI grading** — Grade Now flow (individual per-participant)
8. **Group comparison report** — Leaderboard + `aiCompareGroup()` + matrix grid in `admin_assessment_report.html`
9. **Result send** — Email individual results to participants (no group report in email)
10. **AI enhance** — Add `aiEnhanceQuestion()` to question builder (can be done in parallel with step 3)
