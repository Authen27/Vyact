# Split-sharing email delivery — setup (v10.15.0)

The `send-split-email` edge function sends real email when a split is shared,
settled, or closed. It's **inert until a transport is configured** (before that
it returns `email_not_configured` and the app is unaffected — in-app
notifications still fire). Nothing here is committed to the repo.

> **Why not Supabase's own email?** Supabase's built-in email is **auth-only**
> (confirmation / magic-link / reset / invite) with **no general send-email
> API**, so it can't carry custom split content. You point this function at a
> mail transport instead — **MailerSend** (MailerLite's transactional API),
> **SMTP** (any provider), or **Resend**.
>
> **On MailerLite:** MailerLite's *own* API is marketing/subscriber-oriented and
> not suited to one-off transactional sends. Its transactional product is
> **MailerSend** (same company) — that's what the function targets natively.

## 1. Pick a transport & get credentials

**Option A — MailerSend (recommended; MailerLite's transactional API).** Sign up
at <https://mailersend.com> (free tier ~3,000 emails/mo; you can use your
MailerLite login). **Verify a sender domain** (Domains → add DNS records), then
create an **API token** (`mlsn_...`).

**Option B — SMTP.** Any provider works: MailerSend's own SMTP
(`smtp.mailersend.net:587`), Amazon SES, Mailgun, Postmark, or a Gmail
app-password for testing. Get host, port (465 implicit TLS / 587 STARTTLS),
username, password. Use a **verified sender domain**.

**Option C — Resend REST.** Account at <https://resend.com>, verify a domain,
create an API key (`re_...`). `onboarding@resend.dev` works for a smoke test but
only delivers to your own Resend account email.

## 2. Set the Supabase secrets

From the repo root (needs the Supabase CLI, logged in / linked to project
`dmxqkvploojokffuhxnz`). Precedence: **MailerSend → SMTP → Resend**.

```bash
# Option A — MailerSend (MailerLite transactional):
supabase secrets set MAILERSEND_API_KEY=mlsn_your_token_here \
  SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"

# Option B — SMTP (e.g. MailerSend SMTP):
supabase secrets set SMTP_HOST=smtp.mailersend.net SMTP_PORT=587 \
  SMTP_USER=your_smtp_user SMTP_PASS=your_smtp_password \
  SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"

# Option C — Resend:
supabase secrets set RESEND_API_KEY=re_your_key_here \
  SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"

# optional (all) — link target in emails; defaults to the live app URL:
supabase secrets set APP_URL=https://vyact-twentyx.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do
not set them. Never paste credentials into code or commit them. With MailerSend,
`SPLIT_EMAIL_FROM` must use your **verified** MailerSend domain.

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
- **Transport precedence:** MailerSend → SMTP → Resend (first with secrets set
  wins). To switch, unset the higher-precedence secrets
  (`supabase secrets unset MAILERSEND_API_KEY ...`).
- **Not an MCP:** email is sent by the deployed edge function at runtime — an MCP
  server is a chat-time tool and can't be the sender here, so this uses
  MailerSend's HTTP API (or SMTP) with a token stored as a Supabase secret.
- **SMTP from edge functions:** the function uses `denomailer` over an outbound
  SMTP connection (Supabase Edge Functions allow outbound TCP). Port 465 uses
  implicit TLS; 587 upgrades via STARTTLS.
