# Security Policy

## Reporting a vulnerability

If you discover a security issue in Vyact, please **do not** open a public GitHub issue.

Email: **support@vyact.app** with "Security" in the subject.

Include:
- A clear description of the issue and the impact
- Steps to reproduce (or a proof-of-concept)
- The version / commit affected
- Your name and contact, if you'd like to be credited in the fix

You'll get an acknowledgement within 48 hours and a remediation plan within
10 business days for confirmed issues.

## Scope

In scope:
- The consumer app at `react/` and any production deployments
- The admin app at `admin/` and any production deployments
- The Supabase project's RLS policies, RPCs, and view definitions
- The DataAdapter abstractions (`react/src/lib/*Adapter*`)

Out of scope:
- Issues that require physical access to a user's device
- Issues that require an already-compromised auth token
- Issues that depend on outdated browser versions (we support the latest 2 versions of Chrome/Safari/Firefox/Edge)
- DoS via amplification (rate-limited at the Supabase + Vercel edge)

## Hardening already in place

- All tables RLS-enabled; policies enforce per-household isolation
- Security-definer functions pinned to `search_path = public`
- Internal helper functions (`is_member`, `role_in`, trigger handlers) revoked from `anon`/`authenticated`
- Public-facing RPCs (`accept_invitation`, `transfer_ownership`, `leave_household`) only callable by `authenticated`
- Views use `security_invoker = true` so RLS applies to the calling user
- Admin app responds with `X-Robots-Tag: noindex, nofollow` to keep it out of search results
- HSTS preload, frame-ancestors deny, no-referrer (admin) / strict-origin (consumer)
- Anon Supabase key is publicly safe (RLS guards data); service-role key never ships to the browser

## What we don't ship that you should add for production

- Email/SMTP for sending invitations — wire `send-invite-email` Edge Function
- IP allowlist or Workspace SSO for the admin app (Vercel paid feature)
- An ENFORCED Content Security Policy on vyact.app — it is report-only, with reports logged by
  `/api/csp-report` since v10.125.0; enforce it after a clean week (admin.vyact.app already enforces one)
- Backup/recovery runbook — Supabase auto-backs-up paid tiers; Free tier needs manual `pg_dump` cadence
- Penetration test before processing real PII

## If personal data is breached (runbook)

v10.125.0 (T4b; audit XC-PRV-11). The Privacy Policy (section 10) promises this. A breach is any
unauthorised access to, loss of, or disclosure of personal data: a leaked key, a policy that let one household
read another's rows, a lost device with a database dump, a provider's incident.

1. **Contain** — revoke the key or session, close the hole (a migration, a disabled function, a rotated
   secret), and keep the evidence: logs, the commit, the timeline.
2. **Assess** — what data, whose, how many people, since when, and whether it was read or only exposed.
3. **Notify the Data Protection Board of India** without delay with what is known, and send the full
   report within **72 hours**, as the Digital Personal Data Protection Rules require.
4. **Notify each person affected** without delay: what happened, what data, the likely consequences, what
   Vyact is doing, what they can do (for example, change a password), and who to contact.
5. **Where the GDPR applies** (people in the EU or UK), notify the competent supervisory authority within
   72 hours of becoming aware of it, unless the breach is unlikely to put anyone at risk.
6. **Record it** — keep a dated record of every breach, including ones that did not need notifying, with
   the decision and the reasons.

The data fiduciary's details and the Grievance Officer are to be published on the Privacy Policy (section 6);
until then, notices are signed by Vyact and replies go to support@vyact.app.
