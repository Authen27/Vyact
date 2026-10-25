# Observability: job runs, the health email, and error reports

v10.132.0 (Track Q4; audit OPS-06, DB-OPS-08, FE-UIS-12; owner decision D9, 20 Oct 2026).

## What runs on its own

| Piece | Where | Needs |
|---|---|---|
| `job_runs`: one row per scheduled run (ok · partial · failed, counts only, 30 days) | every pg_cron job | nothing: on from the migration |
| Admin **Health** page | admin.vyact.app/health (super and roles admins) | nothing |
| Hourly **health email** about a job that failed, partly failed twice, or stopped | `job-health` Edge Function | `HEALTH_ALERT_EMAIL` and an email transport (the one split emails use) |
| **Error reports** from the app (vyact.app, the Android app) | Sentry, EU region | `VITE_SENTRY_DSN` in `react/.env.production` |
| **Error reports** from the Edge Functions (a scheduled job that throws) | Sentry, EU region | the `SENTRY_DSN` Edge secret |

Everything that needs a value is inert until the value is set.

## Owner set-up

1. **Sentry** (sentry.io, data region **EU**):
   - Create two projects, `vyact-web` (Browser JavaScript) and `vyact-edge` (Deno or Node).
   - In each project, under *Settings → Security & Privacy*, turn on **Prevent Storing of IP Addresses** and leave
     **Data Scrubber** on. Vyact sends no user, no request body and no replay; this keeps Sentry from adding an IP.
   - Send me the two DSNs. `vyact-web`'s goes in `react/.env.production` (it is a public key, like the Supabase
     anon key). `vyact-edge`'s is a secret:
     ```bash
     supabase secrets set SENTRY_DSN="https://…@o….ingest.de.sentry.io/…" --project-ref dmxqkvploojokffuhxnz
     ```
2. **Health email:**
   ```bash
   supabase secrets set HEALTH_ALERT_EMAIL="you@example.com" --project-ref dmxqkvploojokffuhxnz
   ```
   It uses the same transport as split and invite emails (MailerSend, SMTP or Resend; `docs/EMAIL_TEMPLATES.md`).

## Checking it (read-only)

```sql
-- The latest run of each job, and the problem the email would be about.
select job, every_minutes, last_started_at, last_status, problem from public.job_health();

-- One job's recent runs.
select started_at, status, summary, error from public.job_runs where job = 'whatsapp-dispatch-weekly'
 order by started_at desc limit 10;
```

A job that has never recorded a run is counted from the first run recorded anywhere, so nothing reads as late
before the migration's first runs.

## What an error report holds

The error's type and its message with emails, ids, tokens, numbers of two digits or more and query strings taken
out (300 characters at most); the stack's file and line numbers; the fault's context tag; the page path without its
query or ids; the app version and platform. Never the screen, a replay, a trail of clicks, the person, their
household or their figures. The rule is `scrub` in `react/src/lib/errorReport.ts`, copied exactly into
`supabase/functions/_shared/errorReport.ts` (test Q4-003 keeps them identical).
