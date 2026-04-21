-- ============================================================
-- Fix missing unique constraints for upsert operations
-- Run this AFTER rls-policies.sql
-- ============================================================

SET search_path TO "Corporate-Assessment-Tool";

-- 1. Add unique constraint on v2-responses (session_id, question_id)
--    Required for the upsert in Participant Live Assessment.
--    Without this, participant responses silently fail to save.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'v2_responses_session_question_unique'
  ) THEN
    ALTER TABLE "v2-responses"
      ADD CONSTRAINT v2_responses_session_question_unique
      UNIQUE (session_id, question_id);
    RAISE NOTICE 'Added unique constraint on v2-responses(session_id, question_id)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on v2-responses';
  END IF;
END $$;

-- 2. Add unique constraint on v2-auto-saves (session_id)
--    Required for the auto-save upsert.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'v2_auto_saves_session_unique'
  ) THEN
    ALTER TABLE "v2-auto-saves"
      ADD CONSTRAINT v2_auto_saves_session_unique
      UNIQUE (session_id);
    RAISE NOTICE 'Added unique constraint on v2-auto-saves(session_id)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on v2-auto-saves';
  END IF;
END $$;
