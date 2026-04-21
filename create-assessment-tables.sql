-- ============================================================
-- Assessment Wizard — Database Migration
-- Run in Supabase SQL Editor (Corporate-Assessment-Tool schema)
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

-- ---- Extend existing v2-assessments table ----
ALTER TABLE "v2-assessments"
  ADD COLUMN IF NOT EXISTS scope                    text DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS group_size               int,
  ADD COLUMN IF NOT EXISTS total_questions          int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_limit_minutes       int,
  ADD COLUMN IF NOT EXISTS instructions             text,
  ADD COLUMN IF NOT EXISTS notification_dismissed   bool DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_comparison_report  jsonb,
  ADD COLUMN IF NOT EXISTS group_report_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS graded_at                timestamptz,
  ADD COLUMN IF NOT EXISTS created_by               uuid;

-- ---- v2-assessment-questions ----
CREATE TABLE IF NOT EXISTS "v2-assessment-questions" (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  order_index    int NOT NULL DEFAULT 1,
  type           text NOT NULL CHECK (type IN ('text','mcq','long_text_attachment','code')),
  prompt         text NOT NULL,
  options        jsonb,          -- MCQ: [{label, text, isCorrect}]
  correct_answer text,           -- MCQ / text auto-grade
  max_points     int DEFAULT 10,
  language       text,           -- code questions
  starter_code   text,           -- code questions
  ai_enhanced    bool DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

-- ---- v2-assessment-invites ----
CREATE TABLE IF NOT EXISTS "v2-assessment-invites" (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  org_id         uuid,
  email          text NOT NULL,
  name           text,
  otp            text,
  link_token     text UNIQUE DEFAULT gen_random_uuid()::text,
  status         text DEFAULT 'invited'
                   CHECK (status IN ('invited','started','submitted','graded')),
  invited_at     timestamptz DEFAULT now(),
  started_at     timestamptz,
  submitted_at   timestamptz
);

-- ---- v2-assessment-responses ----
CREATE TABLE IF NOT EXISTS "v2-assessment-responses" (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id       uuid NOT NULL REFERENCES "v2-assessment-invites"(id) ON DELETE CASCADE,
  assessment_id   uuid NOT NULL,
  question_id     uuid NOT NULL REFERENCES "v2-assessment-questions"(id) ON DELETE CASCADE,
  answer_text     text,
  answer_choice   text,          -- MCQ selected value
  attachment_url  text,          -- long_text_attachment uploads
  submitted_at    timestamptz DEFAULT now()
);

-- ---- v2-assessment-results ----
CREATE TABLE IF NOT EXISTS "v2-assessment-results" (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id       uuid NOT NULL REFERENCES "v2-assessment-invites"(id) ON DELETE CASCADE,
  assessment_id   uuid NOT NULL,
  score           int DEFAULT 0,
  total_points    int DEFAULT 0,
  passed          bool DEFAULT false,
  ai_feedback     text,
  criteria_scores jsonb,
  graded_at       timestamptz DEFAULT now(),
  result_sent     bool DEFAULT false,
  result_sent_at  timestamptz
);

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_aq_assessment   ON "v2-assessment-questions"(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_assessment   ON "v2-assessment-invites"(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_token        ON "v2-assessment-invites"(link_token);
CREATE INDEX IF NOT EXISTS idx_ai_org          ON "v2-assessment-invites"(org_id);
CREATE INDEX IF NOT EXISTS idx_ar_invite       ON "v2-assessment-responses"(invite_id);
CREATE INDEX IF NOT EXISTS idx_ar_assessment   ON "v2-assessment-responses"(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ares_invite     ON "v2-assessment-results"(invite_id);
CREATE INDEX IF NOT EXISTS idx_ares_assessment ON "v2-assessment-results"(assessment_id);

-- ---- RLS Policies ----

-- v2-assessment-questions: org admins can manage; read allowed for active invites
ALTER TABLE "v2-assessment-questions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aq_admin_all" ON "v2-assessment-questions";
CREATE POLICY "aq_admin_all" ON "v2-assessment-questions"
  USING (
    assessment_id IN (
      SELECT id FROM "v2-assessments"
      WHERE org_id IN (
        SELECT org_id FROM "v2-users" WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- v2-assessment-invites: org admins full access
ALTER TABLE "v2-assessment-invites" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_admin_all" ON "v2-assessment-invites";
CREATE POLICY "ai_admin_all" ON "v2-assessment-invites"
  USING (
    org_id IN (
      SELECT org_id FROM "v2-users" WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- v2-assessment-responses: org admins full access
ALTER TABLE "v2-assessment-responses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ar_admin_all" ON "v2-assessment-responses";
CREATE POLICY "ar_admin_all" ON "v2-assessment-responses"
  USING (
    assessment_id IN (
      SELECT id FROM "v2-assessments"
      WHERE org_id IN (
        SELECT org_id FROM "v2-users" WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- v2-assessment-results: org admins full access
ALTER TABLE "v2-assessment-results" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ares_admin_all" ON "v2-assessment-results";
CREATE POLICY "ares_admin_all" ON "v2-assessment-results"
  USING (
    assessment_id IN (
      SELECT id FROM "v2-assessments"
      WHERE org_id IN (
        SELECT org_id FROM "v2-users" WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

RAISE NOTICE 'Assessment wizard tables created successfully.';
