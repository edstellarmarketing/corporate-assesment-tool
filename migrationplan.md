# Corporate Assessment Tool — Supabase Migration Plan

Migration from the deleted Supabase instance to the new self-hosted instance under schema `Corporate-Assessment-Tool`, alongside the existing `Marketing-PM-Tool` schema on the same shared Postgres/Supabase deployment.

## New instance credentials

- **URL:** `https://supabasekong-dfpiopwrqgdf8iods10d4546.187.127.140.202.sslip.io`
- **Anon key:** stored in Vercel env var `SERVICE_SUPABASEANON_KEY` — do not commit here
- **Service role key:** stored in Vercel env var `SERVICE_SUPABASESERVICE_KEY` — do not commit here
- **Target schema:** `Corporate-Assessment-Tool`
- **Admin email:** `marketing@edstellar.com` (shared with Marketing-PM-Tool; single `auth.users` row, two per-schema profile rows)

---

## PHASE 1 — Pre-flight (you, on the server)

### Step 1.1 — SSH into the docker host
Confirm shell access. Everything downstream depends on it.

### Step 1.2 — Inspect current PostgREST config
```bash
docker ps | grep rest
docker exec <rest-container-name> env | grep PGRST_DB_SCHEMAS
```
Record the current comma-separated value. You'll **append** to it, never replace.

### Step 1.3 — Check existing auth helper functions (collision check)
In Supabase SQL editor:
```sql
SELECT proname FROM pg_proc WHERE pronamespace = 'auth'::regnamespace;
```
If `user_org_id` or `user_role` already exist (created by PM-Tool), the new policies will rename to `cat_user_org_id` / `cat_user_role`.

### Step 1.4 — Check existing edge function names
List deployed functions; confirm `ai-grade` isn't already used by PM-Tool. If it is, rename to `ai-grade-cat`.

---

## PHASE 2 — Expose the schema (you, on the server)

### Step 2.1 — Create the schema
In Supabase SQL editor:
```sql
CREATE SCHEMA IF NOT EXISTS "Corporate-Assessment-Tool";
GRANT USAGE ON SCHEMA "Corporate-Assessment-Tool" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "Corporate-Assessment-Tool" TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "Corporate-Assessment-Tool"
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
```

### Step 2.2 — Append schema to PostgREST env
Edit `docker-compose.yml` (or `.env`), locate `PGRST_DB_SCHEMAS`, append `,Corporate-Assessment-Tool` to the existing list. Do **not** remove existing schemas.

### Step 2.3 — Restart REST + Kong (low-traffic window)
```bash
docker compose restart rest kong
```
Expect ~10-second API blip for PM-Tool. Verify PM-Tool recovers by loading its dashboard once.

### Step 2.4 — Verify new schema is reachable
```bash
curl -H "apikey: <anon-key>" -H "Accept-Profile: Corporate-Assessment-Tool" \
  https://supabasekong-dfpiopwrqgdf8iods10d4546.187.127.140.202.sslip.io/rest/v1/
```
Should return `{}` or schema intro, not `PGRST106`.

---

## PHASE 3 — Schema DDL (me authors, you runs)

### Step 3.1 — Author `create-core-tables.sql`
Reconstruct all 25 core `v2-*` CREATE TABLE statements from code inspection. Prefix file with `SET search_path TO "Corporate-Assessment-Tool";`.

### Step 3.2 — Patch the 3 add-on SQL files
`create-ai-data-table.sql`, `create-otp-table.sql`, `create-report-table.sql` — add the `SET search_path` prefix. Replace the placeholder Apps Script URL in `create-otp-table.sql:48` with the real Corporate-Assessment-Tool Web App URL.

### Step 3.3 — Patch `rls-policies.sql`
- Rename helper functions to `auth.cat_user_org_id()` / `auth.cat_user_role()` if Step 1.3 flagged a collision (otherwise keep existing names).
- Qualify table refs inside the functions as `"Corporate-Assessment-Tool"."v2-users"`.
- Add `SET search_path` prefix.

### Step 3.4 — Patch the 2 fix SQL files
`fix-response-constraints.sql`, `fix-otp-rls-anon.sql` — add schema prefix.

### Step 3.5 — Run scripts in order in Supabase SQL editor
1. `create-core-tables.sql`
2. `create-ai-data-table.sql`
3. `create-otp-table.sql`
4. `create-report-table.sql`
5. `rls-policies.sql`
6. `fix-response-constraints.sql`
7. `fix-otp-rls-anon.sql`

After each: check "Query returned successfully" — stop and report if any fail.

### Step 3.6 — Verify tables in Studio
Open Table Editor → schema dropdown → `Corporate-Assessment-Tool`. You should see 28 tables.

---

## PHASE 4 — Client code changes (me)

### Step 4.1 — Update `supabase-client.js`
- Line 12: new URL
- Line 13: new anon key
- Line 46: add `db: { schema: 'Corporate-Assessment-Tool' }` to `createClient` options

### Step 4.2 — Update `settings.html`
- Line 207: new URL default
- Line 214: new anon key default

### Step 4.3 — Update `supabase/functions/ai-grade/index.ts`
- Lines 35, 38: add `{ db: { schema: 'Corporate-Assessment-Tool' } }` to both `createClient` calls
- Rename function to `ai-grade-cat` if collision found in Step 1.4

---

## PHASE 5 — Auth + seed (you)

### Step 5.1 — Create admin auth user
In Supabase Studio → Authentication → Users → Add user:
- Email: `marketing@edstellar.com`
- Password: set one
- Auto-confirm: yes

### Step 5.2 — Grab the new user's UUID
Copy from the Users list. Needed if the seed's `getSession()` fallback fails.

### Step 5.3 — Run the seed
1. Open `login.html` in browser, log in as the new admin
2. Open browser console on any page (e.g., `admin_dashboard.html`)
3. Paste contents of `seed-data.js`
4. Run `await seedAll()`
5. Watch for "Seed complete!" — confirms org, departments, programmes, admin row, settings inserted

### Step 5.4 — Insert Apps Script URL into settings
If not already seeded via `create-otp-table.sql`, insert manually in SQL editor:
```sql
INSERT INTO "Corporate-Assessment-Tool"."v2-settings" (org_id, key, value)
VALUES ((SELECT id FROM "Corporate-Assessment-Tool"."v2-organizations" LIMIT 1),
        'email_webapp_url', '"<your-cat-webapp-url>"');
```

---

## PHASE 6 — Edge function (you)

### Step 6.1 — Deploy `ai-grade` (or `ai-grade-cat` if renamed)
```bash
supabase functions deploy ai-grade --project-ref <your-project>
```

### Step 6.2 — Set function env vars
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — all pointing to the new instance. (Usually already set on self-hosted; verify.)

### Step 6.3 — Set `openrouterKey` in v2-settings
Via admin Settings page, paste OpenRouter API key and save. This is what `ai-grade` reads for model calls.

---

## PHASE 7 — Smoke test (you)

### Step 7.1 — Admin flows
- Login as admin → dashboard loads, shows 0 employees / 0 assessments (fresh seed)
- Create an employee
- Create an assessment with 1 MCQ + 1 scenario question
- Assign to the employee
- Verify Apps Script email triggers (participant gets OTP email)

### Step 7.2 — Participant flow
- Open assignment link → OTP screen → enter OTP → assessment loads
- Answer both questions → submit
- Verify session status flips to `submitted`

### Step 7.3 — AI grading
- Admin → Reports → trigger AI grade on the submitted session
- Verify `ai-grade` function executes successfully (check function logs)
- Report renders with scores + AI narrative

### Step 7.4 — Certificate
- If passing threshold met, certificate auto-generates
- Open certificate URL anonymously to confirm public verify policy works

### Step 7.5 — Regression check on PM-Tool
- Load Marketing-PM-Tool dashboard
- Confirm all queries still return data (PostgREST restart shouldn't have affected it, but verify)

---

## PHASE 8 — Cleanup (me, after green smoke test)

### Step 8.1 — Confirm hardcoded defaults
Once `settings.html` persists the new values to localStorage for all users, the hardcoded defaults in `supabase-client.js` act as a safety net — leave as-is but confirmed pointing to the new instance.

### Step 8.2 — Commit all changes (if repo becomes a git repo)

---

## Time estimates per phase

| Phase | Owner | Time |
|---|---|---|
| 1 Pre-flight | You | 10 min |
| 2 Expose schema | You | 15 min |
| 3 Schema DDL | Me ~90 min authoring, you ~20 min running | 110 min |
| 4 Client code | Me | 15 min |
| 5 Auth + seed | You | 20 min |
| 6 Edge function | You | 15 min |
| 7 Smoke test | You | 45 min |
| 8 Cleanup | Me | 10 min |
| **Total** | | **~4 hrs** |

---

## Tables to be created (28 total)

**Core 25 (via `create-core-tables.sql`):**
`v2-organizations`, `v2-departments`, `v2-users`, `v2-programmes`, `v2-assessments`, `v2-assessment-sections`, `v2-assessment-rubric`, `v2-questions`, `v2-mcq-options`, `v2-rubric-criteria`, `v2-test-cases`, `v2-assignments`, `v2-sessions`, `v2-responses`, `v2-auto-saves`, `v2-gradings`, `v2-grading-queue`, `v2-rubric-scores`, `v2-test-results`, `v2-competency-scores`, `v2-integrity-logs`, `v2-integrity-summary`, `v2-certificates`, `v2-activity-log`, `v2-settings`

**Add-on 3:**
`v2-ai-assessment-data`, `v2-assessment-otp`, `v2-assessment-reports`

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `PGRST_DB_SCHEMAS` env overwritten instead of appended — breaks PM-Tool | Read current value first, append only, verify via curl before declaring done |
| PostgREST restart blip affects PM-Tool (~10s) | Execute during low-traffic window |
| `auth.user_org_id()` / `auth.user_role()` name collision with PM-Tool | Check with `pg_proc` query in Step 1.3; rename to `cat_*` variants if collision found |
| `ai-grade` function name collision | Check existing functions in Step 1.4; rename to `ai-grade-cat` if needed |
| Reconstructed schema missing columns used in deep views | Surface as runtime errors during smoke test; patch with ALTER TABLE ADD COLUMN |
| Apps Script Web App URL wrong | Store in `v2-settings.email_webapp_url`; fixable without code change |

---

## Prerequisites to start Phase 3

1. Phase 1 (SSH + collision checks) completed; results shared.
2. Phase 2 (schema created + PostgREST restarted + curl returns non-PGRST106) completed.
3. Apps Script Web App URL for Corporate-Assessment-Tool ready to bake into `create-otp-table.sql`.
