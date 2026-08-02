# Split-sharing email delivery — setup (v10.15.0)

The `send-split-email` edge function sends real email when a split is shared,
settled, or closed. It's **inert until a transport is configured** (before that
it returns `email_not_configured` and the app is unaffected — in-app
notifications still fire). Nothing here is committed to the repo.

> **Why not Supabase's own email?** Supabase's built-in email is **auth-only**
> (confirmation / magic-link / reset / invite) with **no general send-email
> API**, so it can't carry custom split content. You point this function at a
> mail transport instead — either **SMTP** (recommended: reuse the same provider
> you'd set as Supabase Auth → *Custom SMTP*) or **Resend**.

## 1. Pick a transport & get credentials

**Option A — SMTP (recommended).** Any provider works: Amazon SES, Mailgun,
Postmark, SendGrid, Resend's SMTP, or a Gmail app-password for testing. Get the
host, port (465 for implicit TLS, 587 for STARTTLS), username, and password.
Use a **verified sender domain** so mail doesn't land in spam.

**Option B — Resend REST.** Create an account at <https://resend.com> (free tier
3,000/mo), **verify a sender domain**, and create an API key (`re_...`).
`onboarding@resend.dev` works for a smoke test but only delivers to your own
Resend account email.

## 2. Set the Supabase secrets

From the repo root (needs the Supabase CLI, logged in / linked to project
`dmxqkvploojokffuhxnz`). **SMTP is checked first**, then Resend.

```bash
# Option A — SMTP:
supabase secrets set SMTP_HOST=smtp.yourprovider.com SMTP_PORT=465 \
  SMTP_USER=your_smtp_user SMTP_PASS=your_smtp_password \
  SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"

# Option B — Resend:
supabase secrets set RESEND_API_KEY=re_your_key_here \
  SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"

# optional (both) — link target in emails; defaults to the live app URL:
supabase secrets set APP_URL=https://vyact-twentyx.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do
not set them. Never paste credentials into code or commit them.

## 3. Deploy the function

Either via the Supabase MCP `deploy_edge_function` tool, or:

```bash
supabase functions deploy send-split-email
```

It's deployed with `verify_jwt` on — only signed-in callers can invoke it, and
the function additionally checks the caller owns / participates in the split.

## 4. Verify

- Create a split with a participant email → that address should receive
  "shared a split with you".
- As that participant, settle your share → the owner should receive
  "a split share was settled".
- Close the split → participants should receive "a shared split was closed".

Check delivery in the Resend dashboard (Logs) and the function logs
(`supabase functions logs send-split-email` or the MCP `get_logs`).

## Notes

- **Security:** recipients are resolved server-side from the split id using the
  service role; the client never passes an address, so the function can't be
  used to send mail to arbitrary people. Each event is authorised against the
  caller's JWT (owner for shared/closed; the settling participant for settled).
- **Cost / deliverability:** on the free tier watch the 100/day cap. Use a
  verified domain (not `resend.dev`) so mail doesn't land in spam.
- **Transport precedence:** if both are set, SMTP wins. To switch back to Resend,
  unset the SMTP secrets (`supabase secrets unset SMTP_HOST ...`).
- **SMTP from edge functions:** the function uses `denomailer` over an outbound
  SMTP connection (Supabase Edge Functions allow outbound TCP). Port 465 uses
  implicit TLS; 587 upgrades via STARTTLS.
