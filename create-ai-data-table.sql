-- ============================================================
-- Create table to store AI-generated assessment data
-- Run this AFTER create-core-tables.sql
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

CREATE TABLE IF NOT EXISTS "v2-ai-assessment-data" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id),
  generated_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookup by assessment_id
CREATE INDEX IF NOT EXISTS idx_ai_data_assessment ON "v2-ai-assessment-data"(assessment_id);

-- Enable RLS
ALTER TABLE "v2-ai-assessment-data" ENABLE ROW LEVEL SECURITY;

-- Admin full access within their org
CREATE POLICY "admin_ai_data_all" ON "v2-ai-assessment-data"
  FOR ALL USING (
    org_id = auth.user_org_id() AND auth.user_role() = 'admin'
  );

-- Also fix v2-mcq-options RLS: add explicit WITH CHECK for INSERT
-- (the existing FOR ALL USING policy may silently block inserts)
DROP POLICY IF EXISTS "admin_mcq_all" ON "v2-mcq-options";
CREATE POLICY "admin_mcq_all" ON "v2-mcq-options"
  FOR ALL
  USING (
    question_id IN (
      SELECT q.id FROM "v2-questions" q
      JOIN "v2-assessments" a ON q.assessment_id = a.id
      WHERE a.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  )
  WITH CHECK (
    question_id IN (
      SELECT q.id FROM "v2-questions" q
      JOIN "v2-assessments" a ON q.assessment_id = a.id
      WHERE a.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );
