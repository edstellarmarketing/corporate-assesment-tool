-- ============================================================
-- Seed default LLM model setting into v2-settings
-- Run in Supabase SQL Editor after create-core-tables.sql
-- Replace the org_id value with your actual organization UUID
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

-- Find your org_id first:
-- SELECT id, name FROM "v2-organizations" LIMIT 5;

-- Then upsert the default model (replace the UUID below):
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Auto-pick the first org if only one exists
  SELECT id INTO v_org_id FROM "v2-organizations" LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create one first.';
  END IF;

  -- Default LLM model
  INSERT INTO "v2-settings" (org_id, key, value)
  VALUES (v_org_id, 'defaultModel', '"anthropic/claude-sonnet-4"')
  ON CONFLICT (org_id, key) DO NOTHING;

  -- Task routing defaults (only inserts if not already set)
  INSERT INTO "v2-settings" (org_id, key, value) VALUES
    (v_org_id, 'routeGrading',   '"anthropic/claude-sonnet-4"'),
    (v_org_id, 'routeCode',      '"deepseek/deepseek-chat-v3-0324"'),
    (v_org_id, 'routeNotes',     '"anthropic/claude-sonnet-4"'),
    (v_org_id, 'routeQuestions', '"openai/gpt-4o"'),
    (v_org_id, 'routeFallback',  '"anthropic/claude-haiku-4"'),
    (v_org_id, 'temperature',    '0.3'),
    (v_org_id, 'maxTokensGrading', '2048')
  ON CONFLICT (org_id, key) DO NOTHING;

  RAISE NOTICE 'Default settings seeded for org_id: %', v_org_id;
END $$;
