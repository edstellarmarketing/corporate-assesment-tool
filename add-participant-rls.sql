-- ============================================================
-- Allow participants (anon/public) to access assessment data
-- via link_token. Tokens are UUIDs — unguessable = authorization.
-- Run in Supabase SQL Editor after create-assessment-tables.sql
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

-- v2-assessment-invites: anyone can read/update by link_token
DROP POLICY IF EXISTS "invite_public_read"   ON "v2-assessment-invites";
DROP POLICY IF EXISTS "invite_public_update" ON "v2-assessment-invites";

CREATE POLICY "invite_public_read" ON "v2-assessment-invites"
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "invite_public_update" ON "v2-assessment-invites"
  FOR UPDATE TO anon, authenticated USING (true);

-- v2-assessment-questions: anyone can read questions (questions are not secret)
DROP POLICY IF EXISTS "aq_public_read" ON "v2-assessment-questions";

CREATE POLICY "aq_public_read" ON "v2-assessment-questions"
  FOR SELECT TO anon, authenticated USING (true);

-- v2-assessments: anyone can read assessment metadata
-- (only needed for participant to see title/instructions)
ALTER TABLE "v2-assessments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assessment_public_read" ON "v2-assessments";

CREATE POLICY "assessment_public_read" ON "v2-assessments"
  FOR SELECT TO anon, authenticated USING (true);

-- v2-assessment-responses: participants can insert their own answers
DROP POLICY IF EXISTS "ar_public_insert" ON "v2-assessment-responses";

CREATE POLICY "ar_public_insert" ON "v2-assessment-responses"
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE 'Participant RLS policies added successfully.'; END $$;
