# WhatsApp — Closure Runbook (workflow phase, v10.18)

Companion to `whatsapp-connection-setup.md` (connection foundation) and
`whatsapp-vyact-solutioning.md` (design). This runbook covers **going live with
WhatsApp logging** and the **irreducible human steps** the closure agent waits on.

Everything on the Vyact/Supabase side is automated (code, migration, deploy,
validation). Two things are **inherently human/external** and can't be automated —
Claude must never handle secret values, and Meta approval is off-platform:

1. **Meta dashboard** — app/WABA, System User token, App Secret, webhook registration,
   template approval, Business Verification.
2. **Setting Supabase secrets** — you paste them; Claude never sees them.

---

## 0. What already shipped (no action needed)
- Deterministic parser, `whatsapp_log_transaction` RPC (validated against live schema),
  `whatsapp-webhook` inbound processing, `whatsapp-notify` dispatch, client copy.
- CI deploys `whatsapp-webhook` (`--no-verify-jwt`), `whatsapp-send-otp`,
  `whatsapp-verify-otp`, `whatsapp-notify` on every push to `main`.

## 1. Human checklist to activate INBOUND LOGGING (the MVP)
Inbound logging replies use **session text** (24h window) — **no approved template needed.**

| # | Step | Where | Sets |
| :-- | :-- | :-- | :-- |
| 1 | System User **permanent token** (perm `whatsapp_business_messaging`) | Meta → Business Settings → System Users | `WHATSAPP_ACCESS_TOKEN` |
| 2 | **App Secret** | Meta → App → Settings → Basic | `WHATSAPP_APP_SECRET` |
| 3 | **Verify token** (invent a random string) | you choose | `WHATSAPP_VERIFY_TOKEN` |
| 4 | Set the secrets | terminal | see below |
| 5 | Register **webhook** + subscribe `messages` + *Verify and save* | Meta → WhatsApp → Configuration | callback `https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-webhook` |

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_APP_SECRET=... \
  WHATSAPP_VERIFY_TOKEN=... \
  WHATSAPP_OTP_PEPPER=...            # optional
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
```

> **Note on the OTP link flow:** the `phone_verification_otp` template is **rejected until Meta
> Business Verification completes**, so the in-app *Send code* path can't deliver until then. Inbound
> logging does **not** depend on it — to test now, seed a verified link directly (service role):
> ```sql
> update public.profiles
>    set phone_number='<E164 digits>', phone_verified_at=now(), whatsapp_household_id='<household_uuid>'
>  where id='<auth_uid>';
> ```

## 2. Activate PROACTIVE templates (partner-split, budget/bill alerts, digests)
Each is **inert** until BOTH are true. Add a template name to the allowlist only once Meta shows it **Approved**.
```bash
supabase secrets set \
  WHATSAPP_OUTBOUND_ENABLED=1 \
  WHATSAPP_APPROVED_TEMPLATES="partner_split_prompt,split_shared_with_you,split_settled,budget_threshold_alert,bill_due_reminder,large_transaction_alert,recurring_auto_logged,weekly_summary,reengagement_nudge"
```
The app / edge functions call `whatsapp-notify { event, householdId, toProfileId, params }`; it maps the
event to its template and dispatches only if enabled + approved (else returns `{skipped, reason}`).

## 3. Validate (what the closure agent checks)
- **Webhook GET:** right token → echoes challenge; wrong token → 403.
  `curl "https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=ok"` → `ok`
- **Signed inbound POST** → `200 {"status":"ok"}` + a `whatsapp_inbound_messages` row with `processed_at` set + a new `transactions` row + a confirmation delivered.
- **DB:** `select proname from pg_proc where proname='whatsapp_log_transaction';` (present), and
  `select count(*) from whatsapp_inbound_messages where processed_at is not null;` climbs as messages flow.
- **Live e2e:** from a linked number send `850 groceries hdfc` → the txn appears in the app for that
  household; send "what's my balance?" → hard-block reply (app link), no data.

## 4. The closure agent (autonomous finish)
A scheduled Claude routine that, each run: pulls latest → runs the local gate → ensures the migration
is applied + functions deployed (idempotent) → probes readiness (webhook handshake with the real token;
`pg_proc`/`whatsapp_inbound_messages` via Supabase MCP; a controlled send test for the access token) →
when green, posts a closure report and stops; when not, reports exactly which step above is outstanding
and reschedules. It must run as a **cloud scheduled routine** (nested `claude -p` has no auth here);
fallback is a GitHub Actions `workflow_dispatch` running the deterministic deploy+validate steps.
