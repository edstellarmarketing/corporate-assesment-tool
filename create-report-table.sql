-- ============================================================
-- Create table to store assessment reports per employee
-- Run this AFTER create-core-tables.sql
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

CREATE TABLE IF NOT EXISTS "v2-assessment-reports" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES "v2-sessions"(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "v2-users"(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,

  -- Score data
  total_score numeric DEFAULT 0,
  total_points numeric DEFAULT 0,
  percentage numeric DEFAULT 0,
  passing_score numeric DEFAULT 70,
  passed boolean DEFAULT false,

  -- Counts
  total_questions integer DEFAULT 0,
  answered_count integer DEFAULT 0,
  correct_count integer DEFAULT 0,

  -- AI analysis
  ai_summary text,
  strengths text,
  improvements text,
  question_results jsonb DEFAULT '[]',

  -- Status
  graded_at timestamptz,
  graded_by text DEFAULT 'ai',
  results_sent boolean DEFAULT false,
  results_sent_at timestamptz,
  sent_to_email text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_session ON "v2-assessment-reports"(session_id);
CREATE INDEX IF NOT EXISTS idx_report_user ON "v2-assessment-reports"(user_id);
CREATE INDEX IF NOT EXISTS idx_report_assessment ON "v2-assessment-reports"(assessment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_session_unique ON "v2-assessment-reports"(session_id);

-- Enable RLS
ALTER TABLE "v2-assessment-reports" ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_reports_all" ON "v2-assessment-reports"
  FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin')
  WITH CHECK (org_id = auth.user_org_id() AND auth.user_role() = 'admin');

-- Employees can read their own reports
CREATE POLICY "employee_reports_read" ON "v2-assessment-reports"
  FOR SELECT USING (user_id = auth.uid());
