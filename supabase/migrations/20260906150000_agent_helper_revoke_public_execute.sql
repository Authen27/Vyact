-- v10.20 · Revoke the DEFAULT PUBLIC execute grant on the agent RLS helper.
--
-- 🔴 THIS FILE RECONSTRUCTS A MIGRATION THAT EXISTED ONLY IN THE LIVE DATABASE.
-- It was applied to production on 2026-09-06 via the Supabase MCP, which stamps
-- its own tracker version and writes no file. `supabase/migrations/` is the
-- declared source of truth (CLAUDE.md), so a rebuild from disk would have
-- silently reintroduced the hole this closes. Committing it restores that
-- guarantee. Idempotent — re-running it against production changes nothing.
--
-- THE BUG IT FIXES
-- Postgres grants EXECUTE on a new function to PUBLIC by default, so the
-- explicit `grant ... to authenticated, service_role` in
-- 20260816120000_agent_ingestion_state.sql did NOT stop `anon` reaching this
-- SECURITY DEFINER helper through /rest/v1/rpc/. It bypasses RLS by design, so
-- an anonymous caller could use it as an existence oracle for a
-- (conversation_id, household_id) pair.
--
-- Revoking the default grant makes the explicit grants below the only access
-- path. This is the same class as the `revoke_public_execute` hardening applied
-- to the v4.1 RPCs (20260430092130) — it is the rule, not an exception.

revoke all on function public.agent_conversation_in_household(uuid, uuid) from public;
revoke all on function public.agent_conversation_in_household(uuid, uuid) from anon;
grant execute on function public.agent_conversation_in_household(uuid, uuid) to authenticated, service_role;
