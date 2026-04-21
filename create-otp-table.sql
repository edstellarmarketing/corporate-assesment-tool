-- ============================================================
-- Create OTP table for assessment access control
-- Run this AFTER create-core-tables.sql
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

CREATE TABLE IF NOT EXISTS "v2-assessment-otp" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES "v2-assignments"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "v2-users"(id),
  assessment_id uuid NOT NULL REFERENCES "v2-assessments"(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES "v2-organizations"(id),
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_otp_assignment ON "v2-assessment-otp"(assignment_id);
CREATE INDEX IF NOT EXISTS idx_otp_user ON "v2-assessment-otp"(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_code ON "v2-assessment-otp"(otp_code);

-- Enable RLS
ALTER TABLE "v2-assessment-otp" ENABLE ROW LEVEL SECURITY;

-- Admin full access within their org
CREATE POLICY "admin_otp_all" ON "v2-assessment-otp"
  FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin')
  WITH CHECK (org_id = auth.user_org_id() AND auth.user_role() = 'admin');

-- Employees can read and update their own OTP records
CREATE POLICY "employee_otp_read" ON "v2-assessment-otp"
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "employee_otp_update" ON "v2-assessment-otp"
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NOTE: email_webapp_url is inserted into v2-settings after seed (Phase 5)
-- Run this manually after seedAll() completes:
--
-- INSERT INTO "Corporate-Assessment-Tool"."v2-settings" (org_id, key, value)
-- SELECT id, 'email_webapp_url',
--   '"https://script.google.com/macros/s/AKfycbzS2fUP8m6TMccSJZnMMRRbqvSuY0NZO5Dxy3_16SWl29wWXBrrqaVwPzF_AvZZCXRT/exec"'
-- FROM "Corporate-Assessment-Tool"."v2-organizations" LIMIT 1
-- ON CONFLICT (org_id, key) DO NOTHING;
