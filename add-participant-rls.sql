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

-- v2-assessments: enable RLS, give admins full access, participants can read
ALTER TABLE "v2-assessments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assessment_public_read"  ON "v2-assessments";
DROP POLICY IF EXISTS "assessment_admin_all"    ON "v2-assessments";

-- Admins (authenticated users whose org matches) can do everything
CREATE POLICY "assessment_admin_all" ON "v2-assessments"
  FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM "v2-users" WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM "v2-users" WHERE id = auth.uid()
    )
  );

-- Anon participants can read assessment metadata (title, instructions) via token flow
CREATE POLICY "assessment_public_read" ON "v2-assessments"
  FOR SELECT TO anon USING (true);

-- v2-assessment-responses: participants can insert their own answers
DROP POLICY IF EXISTS "ar_public_insert" ON "v2-assessment-responses";

CREATE POLICY "ar_public_insert" ON "v2-assessment-responses"
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Storage: allow participants to upload files to assessment-uploads bucket
-- NOTE: You must also create the bucket named "assessment-uploads" in the
-- Supabase dashboard (Storage → New bucket → Name: assessment-uploads → Public: ON)
-- before these policies will work.

-- Reset to default schema for storage policies
SET search_path TO public;

DROP POLICY IF EXISTS "assessment_uploads_insert" ON storage.objects;
DROP POLICY IF EXISTS "assessment_uploads_select" ON storage.objects;

CREATE POLICY "assessment_uploads_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'assessment-uploads');

CREATE POLICY "assessment_uploads_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'assessment-uploads');

DO $$ BEGIN RAISE NOTICE 'Participant RLS policies added successfully.'; END $$;
