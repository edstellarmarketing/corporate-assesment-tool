-- ============================================================
-- Fix RLS policies to allow OTP-based assessment access
-- without requiring Supabase login.
--
-- Participants access via email link with ?assignment=xxx
-- and verify with OTP code — no login needed.
--
-- Run this AFTER fix-response-constraints.sql
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

-- Allow anonymous users to read assignments (to show assessment title on OTP screen)
CREATE POLICY "anon_assignment_read" ON "v2-assignments"
  FOR SELECT USING (true);

-- Allow anonymous users to read assessment info (title, duration)
CREATE POLICY "anon_assessment_read" ON "v2-assessments"
  FOR SELECT USING (true);

-- Allow anonymous users to read and update OTP records (for verification)
CREATE POLICY "anon_otp_read" ON "v2-assessment-otp"
  FOR SELECT USING (true);

CREATE POLICY "anon_otp_update" ON "v2-assessment-otp"
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Allow anonymous users to read user info (to get user_id/org_id from OTP)
CREATE POLICY "anon_user_read" ON "v2-users"
  FOR SELECT USING (true);

-- Allow anonymous users to create sessions (after OTP verification)
CREATE POLICY "anon_session_insert" ON "v2-sessions"
  FOR INSERT WITH CHECK (true);

-- Allow anonymous users to read their session
CREATE POLICY "anon_session_read" ON "v2-sessions"
  FOR SELECT USING (true);

-- Allow anonymous users to update sessions (for submission)
CREATE POLICY "anon_session_update" ON "v2-sessions"
  FOR UPDATE USING (true);

-- Allow anonymous users to update assignment status
CREATE POLICY "anon_assignment_update" ON "v2-assignments"
  FOR UPDATE USING (true);

-- Allow anonymous users to read questions and MCQ options (for the assessment)
CREATE POLICY "anon_questions_read" ON "v2-questions"
  FOR SELECT USING (true);

CREATE POLICY "anon_mcq_read" ON "v2-mcq-options"
  FOR SELECT USING (true);

-- Allow anonymous users to read assessment sections
CREATE POLICY "anon_sections_read" ON "v2-assessment-sections"
  FOR SELECT USING (true);

-- Allow anonymous users to insert/update responses
CREATE POLICY "anon_responses_insert" ON "v2-responses"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_responses_update" ON "v2-responses"
  FOR UPDATE USING (true);

CREATE POLICY "anon_responses_read" ON "v2-responses"
  FOR SELECT USING (true);

-- Allow anonymous users to insert auto-saves
CREATE POLICY "anon_autosave_insert" ON "v2-auto-saves"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_autosave_update" ON "v2-auto-saves"
  FOR UPDATE USING (true);

-- Allow anonymous users to insert integrity logs
CREATE POLICY "anon_integrity_insert" ON "v2-integrity-logs"
  FOR INSERT WITH CHECK (true);

-- Allow anonymous users to insert grading queue items (on submit)
CREATE POLICY "anon_grading_queue_insert" ON "v2-grading-queue"
  FOR INSERT WITH CHECK (true);
