# Security Policy

## Reporting a vulnerability

If you discover a security issue in FinFlow, please **do not** open a public GitHub issue.

Email: **security@finflow.app** (or open a private security advisory at
`https://github.com/<org>/finflow/security/advisories/new`).

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
- Content Security Policy (CSP) header — start with `connect-src 'self' *.supabase.co`
- Backup/recovery runbook — Supabase auto-backs-up paid tiers; Free tier needs manual `pg_dump` cadence
- Penetration test before processing real PII
