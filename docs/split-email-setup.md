# Split-sharing email delivery — setup (v10.15.0)

The `send-split-email` edge function sends real email when a split is shared,
settled, or closed. It uses **Resend** and is **inert until two secrets are
set** (before that it returns `email_not_configured` and the app is unaffected —
in-app notifications still fire). Nothing here is committed to the repo.

## 1. Provision Resend

1. Create an account at <https://resend.com> (free tier: 3,000 emails/mo, 100/day).
2. **Verify a sender domain** (Domains → Add Domain → add the DNS records). This
   is required to email *arbitrary* recipients (your split participants).
   - For a quick test without a domain, Resend's `onboarding@resend.dev` works
     but **only delivers to your own Resend account email** — fine for a smoke
     test, not for real participants.
3. Create an **API key** (API Keys → Create). Copy `re_...` — you'll set it as a
   secret; never paste it into code or commit it.

## 2. Set the Supabase secrets

From the repo root (needs the Supabase CLI, logged in / linked to project
`dmxqkvploojokffuhxnz`):

```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"
# optional — link target in emails; defaults to the live app URL:
supabase secrets set APP_URL=https://vyact-twentyx.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do
not set them.

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
- **Swapping providers:** the only provider-specific code is the single `fetch`
  to `api.resend.com/emails` in the function — swap it for SendGrid/SES/Postmark
  and change the two secrets if you prefer another provider.
