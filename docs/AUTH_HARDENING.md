# Auth Hardening Runbook

This runbook documents the configuration steps and recommended UI flow to harden FinFlow authentication (TD-15).

## Goal
- Enable Multi-Factor Authentication (MFA) for user accounts (TOTP).
- Enable leaked-password protection and breached-password checks.
- Apply auth rate limits for common vectors (sign-in, magic-link, password-reset) to reduce credential-stuffing and abuse.

## Supabase configuration (recommended)
1. Open your Supabase project → `Authentication` → `Settings`.
2. Under **Multi-factor authentication**, enable **TOTP** (Time-based One-Time Passwords).
   - Optionally enable **WebAuthn** for security keys if you want a second factor path.
3. Under **Leaked password protection**, turn on breached-password checks (if available).
4. Under **Password policy**, set a reasonable minimum (e.g. `10` characters) and disallow common passwords (supabase or identity provider features may expose this).
5. Under **Rate limits / Abuse protection**, configure:
   - Sign-in attempts per IP: e.g. `60 per hour`.
   - Magic-link sends per email/IP: e.g. `10 per hour`.
   - Password-reset per email/IP: e.g. `5 per hour`.
   Note: if Supabase UI doesn't expose fine-grained rate-limiting, place rate-limiting at the Edge (Vercel/Cloudflare) or behind an Edge Function.
6. Update Auth redirect URLs to include the app origin(s): `${APP_URL}` and any preview URLs used in CI.

## Developer work (client-side)
- Expose an enrolment flow in Settings:
  1. Call `auth.mfa.enroll({ factorType: 'totp', friendlyName })` to create an unverified factor and receive the TOTP provisioning URL (otpauth:// or equivalent).
  2. Render the provisioning QR (e.g. via `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(otpauthUrl)}`) and show the secret as fallback.
  3. Prompt the user for a 6-digit code and call `auth.mfa.verify({ factorId, code })` to verify and activate the factor.
  4. List enrolled factors via `auth.mfa.listFactors()` and allow unenrolling via `auth.mfa.unenroll({ factorId })`.
- Protect UI flows that require cloud mode — TOTP enrolment requires a Supabase-backed account (not local-only mode).

## Security considerations
- Treat the TOTP secret as sensitive; do not log it. Only render it to the user in the enrolment UI.
- For WebAuthn keys, display friendly names and a last-used timestamp if available.
- Enrolment should not silently fallback: if Supabase returns an error, show a helpful message and surface guidance to contact support.
- Consider adding a brief recovery flow: allow users to generate a one-time recovery code on enrolment (store client-side) or require re-login via email + support if they lose their device.

## Monitoring
- Track MFA enrolment rate and failed verification attempts per account/IP.
- Alert when a single account experiences many failed enrollments/verifications.

## Rollout notes
- Start with opt-in: expose the Settings UI and encourage users to enable MFA.
- Later consider enforcing MFA for higher-privilege roles (household admins) or after suspicious activity.

## References
- Supabase Auth docs (Auth → MFA) — check the supabase-js `auth.mfa` API for exact parameter shapes.
- RFC 6238 — TOTP

