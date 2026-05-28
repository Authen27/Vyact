# Superseded migrations (archive — do not re-apply)

These eight files used to live at `supabase/migrations/*.sql`. They were the
**design intent** for the consumer + admin schema between PR #6 and PR #14,
but — as documented in **TD-20** in [`TECH_DEBT.md`](../../TECH_DEBT.md) —
none of them were ever applied to production. Production was reshaped in
parallel through the Supabase Dashboard's SQL editor, and the two histories
drifted apart.

PR #16 (TD-20 reconciliation) closed that gap by capturing the actual
production schema as a single new baseline at
[`supabase/migrations/00000000000001_production_state_baseline.sql`](../../supabase/migrations/00000000000001_production_state_baseline.sql).
That baseline is now the only file the repo's apply path scans, so the
**repo and the live database finally agree**.

These eight files are kept here for **git history and design provenance
only**. Reading them tells the story of how the consumer + admin features
were *meant* to land; the baseline tells you what actually shipped. When
they disagree (e.g. `ai_usage` column layout, `admin_dashboard_kpis`
signature, audit-trigger coverage), **the baseline wins**.

| File | Original intent | What actually shipped |
|---|---|---|
| `00000000000000_initial_schema.sql` | PR #6 — first repo baseline (assumed clean prod) | Superseded; prod was already further along |
| `20260523060000_admin_roles_and_dashboard_kpis.sql` | PR #7 — TD-04 admin roles + KPIs | Applied via Dashboard with a different KPI shape; baseline captures the live shape |
| `20260524070000_budgets_add_period.sql` | PR #13 — TD-13 budget period columns | **Was claimed applied; turned out not to be.** Re-landed in PR #20 as `20260529150000_td13_budgets_add_period.sql`. |
| `20260524071000_audit_triggers.sql` | PR #13 — TD-08 server-side audit triggers | **Not in prod.** Re-landed in PR #20 as `20260529150500_td08_audit_triggers.sql`. |
| `20260524073000_replace_all_rpc.sql` | PR #13 — TD-09 atomic bulk-import RPC | **Not in prod.** Re-landed in PR #20 as `20260529151000_td09_replace_all_rpcs.sql`. |
| `20260524075000_subscriptions_table_and_kpis.sql` | PR #13 — admin subscriptions | Subscriptions table exists in prod with a different shape; baseline captures the live shape |
| `20260524076000_content_items_table_and_kpis.sql` | PR #13 — admin content items | Applied via Dashboard; reflected in baseline |
| `20260524077000_admin_rpcs.sql` | PR #13 — admin list/cancel RPCs | Different RPCs ended up in prod (`admin_list_users`, `admin_weekly_trend`, `admin_ai_usage_summary`); baseline captures the live set |

## Do not move these back

`scripts/db-migrations-check.mjs` only scans `supabase/migrations/`
non-recursively. Anything in this directory is invisible to the CI gate
and to `supabase db push`. **Moving any of these files back into
`supabase/migrations/` would re-introduce the parallel-history drift TD-20
just closed.** If you need to bring back a piece of intent that didn't
make it into the baseline (e.g. the TD-08 audit triggers or the TD-09
`replace_all` RPC), write a **new** additive migration with a fresh
timestamp — don't resurrect these.
