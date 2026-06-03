-- Money Map · Phase 2 — education progress sync (Item #7)
--
-- Spec: docs/SOLUTION_MONEY_MAP.md → "v7.2 Migration B".
-- Trivial additive jsonb column on `profiles`; inherits existing RLS.
--
-- Shape:
--   { "<topic_id>": { "completed_at": iso8601, "dismissed_at": iso8601? } }
--
-- App caps the map at 50 keys (Risk S-3) and prunes on write.

BEGIN;

alter table profiles
  add column if not exists education_progress jsonb not null default '{}'::jsonb;

COMMIT;
