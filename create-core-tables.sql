-- ============================================================
-- CREATE CORE TABLES for Corporate-Assessment-Tool schema
-- Run this FIRST in Supabase SQL Editor
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

-- ============================================================
-- 1. v2-organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-organizations" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  short_name text,
  domain text UNIQUE,
  industry text,
  hq_location text,
  primary_email text,
  contact_email text,
  email_domain text,
  primary_color text DEFAULT '#0e1a2b',
  logo_url text,
  passing_threshold integer DEFAULT 70,
  certificate_prefix text,
  certificate_footer text,
  signatory_name text,
  signatory_title text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. v2-departments
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-departments" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_org ON "v2-departments"(org_id);

-- ============================================================
-- 3. v2-users
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-users" (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text UNIQUE NOT NULL,
  employee_id text,
  job_title text,
  department_id uuid REFERENCES "v2-departments"(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  join_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON "v2-users"(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON "v2-users"(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON "v2-users"(org_id, role);

-- ============================================================
-- 4. v2-programmes
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-programmes" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_programmes_org ON "v2-programmes"(org_id);

-- ============================================================
-- 5. v2-assessments
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-assessments" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id) ON DELETE CASCADE,
  programme_id uuid REFERENCES "v2-programmes"(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  total_points integer DEFAULT 0,
  passing_score integer DEFAULT 70,
  duration_minutes integer DEFAULT 60,
  negative_marking boolean DEFAULT false,
  proctoring boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_org ON "v2-assessments"(org_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON "v2-assessments"(org_id, status);

-- ============================================================
-- 6. v2-assessment-sections
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-assessment-sections" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  name text,
  title text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sections_assessment ON "v2-assessment-sections"(assessment_id);

-- ============================================================
-- 7. v2-assessment-rubric
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-assessment-rubric" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  name text,
  description text,
  max_score integer DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubric_assessment ON "v2-assessment-rubric"(assessment_id);

-- ============================================================
-- 8. v2-questions
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-questions" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  section_id uuid REFERENCES "v2-assessment-sections"(id) ON DELETE SET NULL,
  prompt text,
  question_text text,
  context_text text,
  scenario_text text,
  question_type text NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'essay', 'scenario', 'code', 'coding', 'prompt')),
  points integer DEFAULT 1,
  word_limit integer,
  language text,
  rubric_text text,
  explanation text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_assessment ON "v2-questions"(assessment_id);
CREATE INDEX IF NOT EXISTS idx_questions_section ON "v2-questions"(section_id);

-- ============================================================
-- 9. v2-mcq-options
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-mcq-options" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES "v2-questions"(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  option_text text NOT NULL,
  is_correct boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcq_question ON "v2-mcq-options"(question_id);

-- ============================================================
-- 10. v2-rubric-criteria
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-rubric-criteria" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES "v2-questions"(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  max_score integer DEFAULT 10,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_criteria_question ON "v2-rubric-criteria"(question_id);

-- ============================================================
-- 11. v2-test-cases
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-test-cases" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES "v2-questions"(id) ON DELETE CASCADE,
  input text,
  expected_output text,
  is_hidden boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testcases_question ON "v2-test-cases"(question_id);

-- ============================================================
-- 12. v2-assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-assignments" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "v2-users"(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'submitted')),
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON "v2-assignments"(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assessment ON "v2-assignments"(assessment_id);

-- ============================================================
-- 13. v2-sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-sessions" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "v2-users"(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES "v2-assignments"(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'graded')),
  total_score numeric DEFAULT 0,
  score_percentage numeric DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  time_remaining_sec integer,
  duration_seconds integer,
  attempt_number integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON "v2-sessions"(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_assessment ON "v2-sessions"(assessment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON "v2-sessions"(status);

-- ============================================================
-- 14. v2-responses
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-responses" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES "v2-sessions"(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES "v2-questions"(id) ON DELETE CASCADE,
  response_type text CHECK (response_type IN ('mcq', 'essay', 'code', 'scenario', 'coding')),
  mcq_selected uuid REFERENCES "v2-mcq-options"(id) ON DELETE SET NULL,
  essay_text text,
  code_text text,
  word_count integer DEFAULT 0,
  is_answered boolean DEFAULT false,
  is_flagged boolean DEFAULT false,
  final_score numeric,
  auto_score numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_session ON "v2-responses"(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON "v2-responses"(question_id);

-- ============================================================
-- 15. v2-auto-saves
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-auto-saves" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES "v2-sessions"(id) ON DELETE CASCADE,
  user_id uuid REFERENCES "v2-users"(id) ON DELETE CASCADE,
  responses_data jsonb DEFAULT '{}',
  responses_snapshot jsonb DEFAULT '{}',
  flagged_questions jsonb DEFAULT '[]',
  answered_questions jsonb DEFAULT '[]',
  current_question integer DEFAULT 0,
  saved_at timestamptz DEFAULT now(),
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_autosaves_session ON "v2-auto-saves"(session_id);

-- ============================================================
-- 16. v2-gradings
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-gradings" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES "v2-sessions"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'grading', 'completed', 'graded')),
  total_score numeric DEFAULT 0,
  performance_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gradings_session ON "v2-gradings"(session_id);

-- ============================================================
-- 17. v2-grading-queue
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-grading-queue" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES "v2-sessions"(id) ON DELETE CASCADE,
  question_id uuid REFERENCES "v2-questions"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'grading', 'completed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gradingqueue_session ON "v2-grading-queue"(session_id);
CREATE INDEX IF NOT EXISTS idx_gradingqueue_status ON "v2-grading-queue"(status);

-- ============================================================
-- 18. v2-rubric-scores
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-rubric-scores" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid NOT NULL REFERENCES "v2-responses"(id) ON DELETE CASCADE,
  criteria_id uuid REFERENCES "v2-rubric-criteria"(id) ON DELETE SET NULL,
  name text,
  score numeric DEFAULT 0,
  max_score numeric DEFAULT 10,
  justification text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubricscores_response ON "v2-rubric-scores"(response_id);

-- ============================================================
-- 19. v2-test-results
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-test-results" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid NOT NULL REFERENCES "v2-responses"(id) ON DELETE CASCADE,
  test_case_id uuid REFERENCES "v2-test-cases"(id) ON DELETE SET NULL,
  passed boolean DEFAULT false,
  actual_output text,
  error_message text,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testresults_response ON "v2-test-results"(response_id);

-- ============================================================
-- 20. v2-competency-scores
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-competency-scores" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "v2-users"(id) ON DELETE CASCADE,
  session_id uuid REFERENCES "v2-sessions"(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  competency_name text,
  name text,
  score numeric DEFAULT 0,
  score_pct numeric DEFAULT 0,
  percentage numeric DEFAULT 0,
  question_count integer DEFAULT 0,
  count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competency_user ON "v2-competency-scores"(user_id);

-- ============================================================
-- 21. v2-integrity-logs
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-integrity-logs" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES "v2-sessions"(id) ON DELETE CASCADE,
  user_id uuid REFERENCES "v2-users"(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('tab_blur', 'network_change', 'submission_summary', 'focus_lost', 'copy_paste', 'screenshot')),
  detail jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integritylogs_session ON "v2-integrity-logs"(session_id);

-- ============================================================
-- 22. v2-integrity-summary
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-integrity-summary" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES "v2-sessions"(id) ON DELETE CASCADE,
  user_id uuid REFERENCES "v2-users"(id) ON DELETE CASCADE,
  total_events integer DEFAULT 0,
  tab_blur_count integer DEFAULT 0,
  network_change_count integer DEFAULT 0,
  risk_level text DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  summary jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integritysummary_session ON "v2-integrity-summary"(session_id);

-- ============================================================
-- 23. v2-certificates
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-certificates" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES "v2-sessions"(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES "v2-users"(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES "v2-assessments"(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id) ON DELETE CASCADE,
  verification_code text UNIQUE NOT NULL,
  recipient_name text,
  recipient_role text,
  recipient_department text,
  org_name text,
  assessment_name text,
  programme_name text,
  score_percentage numeric DEFAULT 0,
  performance_band text,
  signatory_name text,
  signatory_title text,
  issued_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON "v2-certificates"(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON "v2-certificates"(verification_code);
CREATE INDEX IF NOT EXISTS idx_certificates_org ON "v2-certificates"(org_id);

-- ============================================================
-- 24. v2-activity-log
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-activity-log" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id) ON DELETE CASCADE,
  user_id uuid REFERENCES "v2-users"(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activitylog_org ON "v2-activity-log"(org_id);
CREATE INDEX IF NOT EXISTS idx_activitylog_created ON "v2-activity-log"(created_at DESC);

-- ============================================================
-- 25. v2-settings
-- ============================================================
CREATE TABLE IF NOT EXISTS "v2-settings" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, key)
);

CREATE INDEX IF NOT EXISTS idx_settings_org ON "v2-settings"(org_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON "v2-settings"(org_id, key);

-- ============================================================
-- RLS HELPER FUNCTIONS
-- Created here so add-on SQL files can reference them immediately
-- ============================================================
CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM "Corporate-Assessment-Tool"."v2-users" WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT role FROM "Corporate-Assessment-Tool"."v2-users" WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
