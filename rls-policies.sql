-- ============================================================
-- RLS Policies for all v2- tables (Corporate-Assessment-Tool schema)
-- Run this AFTER create-report-table.sql
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

-- Helper: get the current user's org_id and role from v2-users
CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM "Corporate-Assessment-Tool"."v2-users" WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT role FROM "Corporate-Assessment-Tool"."v2-users" WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE "v2-organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-programmes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-assessment-sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-assessment-rubric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-mcq-options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-rubric-criteria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-test-cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-auto-saves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-gradings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-grading-queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-rubric-scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-test-results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-competency-scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-integrity-logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-integrity-summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-certificates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-activity-log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "v2-settings" ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. ADMIN FULL ACCESS (read/write within their org)
-- ============================================================

-- Macro: for each table with org_id, admin gets full access within their org

-- v2-organizations
CREATE POLICY "admin_org_access" ON "v2-organizations"
  FOR ALL USING (id = auth.user_org_id() AND auth.user_role() = 'admin');

-- v2-departments
CREATE POLICY "admin_dept_all" ON "v2-departments"
  FOR ALL USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin');

-- v2-users
CREATE POLICY "admin_users_all" ON "v2-users"
  FOR ALL USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin');

-- v2-programmes
CREATE POLICY "admin_programmes_all" ON "v2-programmes"
  FOR ALL USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin');

-- v2-assessments
CREATE POLICY "admin_assessments_all" ON "v2-assessments"
  FOR ALL USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin');

-- v2-assessment-sections
CREATE POLICY "admin_sections_all" ON "v2-assessment-sections"
  FOR ALL USING (
    assessment_id IN (SELECT id FROM "v2-assessments" WHERE org_id = auth.user_org_id())
    AND auth.user_role() = 'admin'
  );

-- v2-assessment-rubric
CREATE POLICY "admin_rubric_all" ON "v2-assessment-rubric"
  FOR ALL USING (
    assessment_id IN (SELECT id FROM "v2-assessments" WHERE org_id = auth.user_org_id())
    AND auth.user_role() = 'admin'
  );

-- v2-questions
CREATE POLICY "admin_questions_all" ON "v2-questions"
  FOR ALL USING (
    assessment_id IN (SELECT id FROM "v2-assessments" WHERE org_id = auth.user_org_id())
    AND auth.user_role() = 'admin'
  );

-- v2-mcq-options
CREATE POLICY "admin_mcq_all" ON "v2-mcq-options"
  FOR ALL USING (
    question_id IN (
      SELECT q.id FROM "v2-questions" q
      JOIN "v2-assessments" a ON q.assessment_id = a.id
      WHERE a.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-rubric-criteria
CREATE POLICY "admin_criteria_all" ON "v2-rubric-criteria"
  FOR ALL USING (
    question_id IN (
      SELECT q.id FROM "v2-questions" q
      JOIN "v2-assessments" a ON q.assessment_id = a.id
      WHERE a.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-test-cases
CREATE POLICY "admin_testcases_all" ON "v2-test-cases"
  FOR ALL USING (
    question_id IN (
      SELECT q.id FROM "v2-questions" q
      JOIN "v2-assessments" a ON q.assessment_id = a.id
      WHERE a.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-assignments
CREATE POLICY "admin_assignments_all" ON "v2-assignments"
  FOR ALL USING (
    assessment_id IN (SELECT id FROM "v2-assessments" WHERE org_id = auth.user_org_id())
    AND auth.user_role() = 'admin'
  );

-- v2-sessions
CREATE POLICY "admin_sessions_all" ON "v2-sessions"
  FOR ALL USING (
    user_id IN (SELECT id FROM "v2-users" WHERE org_id = auth.user_org_id())
    AND auth.user_role() = 'admin'
  );

-- v2-responses
CREATE POLICY "admin_responses_all" ON "v2-responses"
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM "v2-sessions" s
      JOIN "v2-users" u ON s.user_id = u.id
      WHERE u.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-auto-saves
CREATE POLICY "admin_autosaves_all" ON "v2-auto-saves"
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM "v2-sessions" s
      JOIN "v2-users" u ON s.user_id = u.id
      WHERE u.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-gradings
CREATE POLICY "admin_gradings_all" ON "v2-gradings"
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM "v2-sessions" s
      JOIN "v2-users" u ON s.user_id = u.id
      WHERE u.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-grading-queue
CREATE POLICY "admin_gradingqueue_all" ON "v2-grading-queue"
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM "v2-sessions" s
      JOIN "v2-users" u ON s.user_id = u.id
      WHERE u.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-rubric-scores
CREATE POLICY "admin_rubricscores_all" ON "v2-rubric-scores"
  FOR ALL USING (
    response_id IN (
      SELECT r.id FROM "v2-responses" r
      JOIN "v2-sessions" s ON r.session_id = s.id
      JOIN "v2-users" u ON s.user_id = u.id
      WHERE u.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-test-results
CREATE POLICY "admin_testresults_all" ON "v2-test-results"
  FOR ALL USING (
    response_id IN (
      SELECT r.id FROM "v2-responses" r
      JOIN "v2-sessions" s ON r.session_id = s.id
      JOIN "v2-users" u ON s.user_id = u.id
      WHERE u.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-competency-scores
CREATE POLICY "admin_competency_all" ON "v2-competency-scores"
  FOR ALL USING (
    user_id IN (SELECT id FROM "v2-users" WHERE org_id = auth.user_org_id())
    AND auth.user_role() = 'admin'
  );

-- v2-integrity-logs
CREATE POLICY "admin_integritylogs_all" ON "v2-integrity-logs"
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM "v2-sessions" s
      JOIN "v2-users" u ON s.user_id = u.id
      WHERE u.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-integrity-summary
CREATE POLICY "admin_integritysummary_all" ON "v2-integrity-summary"
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM "v2-sessions" s
      JOIN "v2-users" u ON s.user_id = u.id
      WHERE u.org_id = auth.user_org_id()
    )
    AND auth.user_role() = 'admin'
  );

-- v2-certificates
CREATE POLICY "admin_certificates_all" ON "v2-certificates"
  FOR ALL USING (
    user_id IN (SELECT id FROM "v2-users" WHERE org_id = auth.user_org_id())
    AND auth.user_role() = 'admin'
  );

-- v2-activity-log
CREATE POLICY "admin_activity_all" ON "v2-activity-log"
  FOR ALL USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin');

-- v2-settings
CREATE POLICY "admin_settings_all" ON "v2-settings"
  FOR ALL USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin');


-- ============================================================
-- 3. EMPLOYEE SELF-ACCESS (read own records)
-- ============================================================

-- Employees can read their own user record
CREATE POLICY "employee_self_read" ON "v2-users"
  FOR SELECT USING (id = auth.uid());

-- Employees can read their own assignments
CREATE POLICY "employee_own_assignments" ON "v2-assignments"
  FOR SELECT USING (
    user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid())
  );

-- Employees can read assessments they're assigned to
CREATE POLICY "employee_assigned_assessments" ON "v2-assessments"
  FOR SELECT USING (
    id IN (
      SELECT assessment_id FROM "v2-assignments"
      WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid())
    )
  );

-- Employees can read sections/questions for their assigned assessments
CREATE POLICY "employee_assessment_sections" ON "v2-assessment-sections"
  FOR SELECT USING (
    assessment_id IN (
      SELECT assessment_id FROM "v2-assignments"
      WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid())
    )
  );

CREATE POLICY "employee_assessment_questions" ON "v2-questions"
  FOR SELECT USING (
    assessment_id IN (
      SELECT assessment_id FROM "v2-assignments"
      WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid())
    )
  );

CREATE POLICY "employee_mcq_options" ON "v2-mcq-options"
  FOR SELECT USING (
    question_id IN (
      SELECT q.id FROM "v2-questions" q
      WHERE q.assessment_id IN (
        SELECT assessment_id FROM "v2-assignments"
        WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid())
      )
    )
  );

-- Employees can read/write their own sessions
CREATE POLICY "employee_own_sessions_read" ON "v2-sessions"
  FOR SELECT USING (user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()));

CREATE POLICY "employee_own_sessions_insert" ON "v2-sessions"
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()));

CREATE POLICY "employee_own_sessions_update" ON "v2-sessions"
  FOR UPDATE USING (user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()));

-- Employees can read/write their own responses (only for active sessions)
CREATE POLICY "employee_own_responses_read" ON "v2-responses"
  FOR SELECT USING (
    session_id IN (SELECT id FROM "v2-sessions" WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()))
  );

CREATE POLICY "employee_own_responses_write" ON "v2-responses"
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM "v2-sessions"
      WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid())
      AND status NOT IN ('submitted', 'graded')
    )
  );

CREATE POLICY "employee_own_responses_update" ON "v2-responses"
  FOR UPDATE USING (
    session_id IN (
      SELECT id FROM "v2-sessions"
      WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid())
      AND status NOT IN ('submitted', 'graded')
    )
  );

-- Employees can read/write their own auto-saves
CREATE POLICY "employee_own_autosaves" ON "v2-auto-saves"
  FOR ALL USING (
    session_id IN (SELECT id FROM "v2-sessions" WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()))
  );

-- Employees can write integrity logs for their sessions
CREATE POLICY "employee_integrity_insert" ON "v2-integrity-logs"
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM "v2-sessions" WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()))
  );

-- Employees can read their own certificates
CREATE POLICY "employee_own_certificates" ON "v2-certificates"
  FOR SELECT USING (user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()));

-- Employees can read their own competency scores
CREATE POLICY "employee_own_competency" ON "v2-competency-scores"
  FOR SELECT USING (user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()));

-- Employees can read their department
CREATE POLICY "employee_dept_read" ON "v2-departments"
  FOR SELECT USING (org_id = auth.user_org_id());

-- Employees can read their org (for branding)
CREATE POLICY "employee_org_read" ON "v2-organizations"
  FOR SELECT USING (id = auth.user_org_id());


-- ============================================================
-- 4. PUBLIC CERTIFICATE VERIFICATION
-- ============================================================

-- Anyone (even unauthenticated with anon key) can verify a certificate by code
CREATE POLICY "public_certificate_verify" ON "v2-certificates"
  FOR SELECT USING (true);

-- Public org read for certificate branding
CREATE POLICY "public_org_read_for_certs" ON "v2-organizations"
  FOR SELECT USING (true);


-- ============================================================
-- 5. GRADING QUEUE INSERT (employees submit to queue)
-- ============================================================
CREATE POLICY "employee_gradingqueue_insert" ON "v2-grading-queue"
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM "v2-sessions" WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()))
  );

-- Employees can also insert integrity summary on submit
CREATE POLICY "employee_integritysummary_insert" ON "v2-integrity-summary"
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM "v2-sessions" WHERE user_id IN (SELECT id FROM "v2-users" WHERE id = auth.uid()))
  );
