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

## 3b. ⛔ RESUME STATE (stalled 2026-08-10) — read this to pick the work back up

**Status:** MVP inbound-logging code is **built, deployed, and validated**; the channel is
**deployed with Meta secrets set** but **not yet exercised** (0 linked numbers, 0 messages).
**Blocker (owner-side, external):** **Meta Business Verification is incomplete**, so the
`phone_verification_otp` template is **rejected** → the in-app *Send code* link flow can't deliver,
so no one can self-link a number yet. Everything on the Vyact/Supabase side is done and inert-safe.

**What is DONE (v10.18.0, on `main`, live):**
- Deterministic parser (`supabase/functions/_shared/whatsapp-parser.ts`), `whatsapp_log_transaction`
  RPC (applied + zero-cost validated + advisor-clean), `whatsapp-webhook` inbound processing
  (deployed v8, smoke-tested: GET wrong-token→403, unsigned POST→401), `whatsapp-notify` proactive
  dispatch (deployed v1, inert), client copy flipped active. Docs + CHANGELOG + version bump shipped.
- Monitoring: **closure agent routine `trig_01QtsmxCV95urbLaKhfyrXrc`** (every 3h, Supabase-connected)
  → https://claude.ai/code/routines/trig_01QtsmxCV95urbLaKhfyrXrc

**RESUME TASK LIST (do in order once Business Verification clears):**
1. Confirm Meta **Business Verification** complete and the **`phone_verification_otp`** template is **Approved**.
2. Verify the WhatsApp **webhook is registered** in Meta (callback + `messages` subscribed) — GET handshake with the real `WHATSAPP_VERIFY_TOKEN` should echo the challenge.
3. **Test the link flow** end-to-end: app → Settings → WhatsApp → Send code → receive OTP → Verify & link. (Interim test path if still blocked: seed a verified link via service role — see §1 note.)
4. **Test inbound logging**: from the linked number text `850 groceries hdfc` → confirm a transaction appears in-app for that household + a session-text confirmation is received; text "what's my balance?" → hard-block reply.
5. **Activate proactive templates** as each is **Approved**: `supabase secrets set WHATSAPP_OUTBOUND_ENABLED=1 WHATSAPP_APPROVED_TEMPLATES="partner_split_prompt,split_shared_with_you,split_settled,budget_threshold_alert,bill_due_reminder,large_transaction_alert,recurring_auto_logged,weekly_summary,reengagement_nudge"`.
6. **Wire `whatsapp-notify` triggers** to the app/edge events (partner-split, budget/bill alerts, split & digest notifications) — currently the dispatch endpoint exists but callers aren't wired (deferred with the proactive phase).
7. **Fix the durable deploy path**: rotate the expired **`SUPABASE_ACCESS_TOKEN`** GitHub secret so CI's `db-migrations` + `deploy-edge-functions` jobs stop failing at `supabase link` (until then, deploy functions via the Supabase MCP — see the memory note).
8. **Verify + retire**: once step 4 passes, the closure agent reports "MVP CLOSED"; **disable routine `trig_01QtsmxCV95urbLaKhfyrXrc`** at its URL.

**RESUME COMMAND (paste to start a fresh session):**
> "Resume Vyact WhatsApp closure (v10.18 workflow phase). Read `whatsapp-closure-runbook.md` §3b + memory `whatsapp-workflow-phase-live` + `ci-supabase-token-expired-use-mcp`. Meta Business Verification was the blocker — check if it's cleared, then work the §3b resume task list in order and report status."

**Release/versioning note:** the workflow phase shipped as **v10.18.0**. The resume work above is a *continuation of the same feature*; only bump the version again (v10.18.1 / v10.19.0) if resuming requires new code (e.g., wiring `whatsapp-notify` triggers in step 6). Pure config/secret/Meta-dashboard activation (steps 1–5) needs **no** version bump.

## 4. The closure agent (autonomous finish)
A scheduled Claude routine that, each run: pulls latest → runs the local gate → ensures the migration
is applied + functions deployed (idempotent) → probes readiness (webhook handshake with the real token;
`pg_proc`/`whatsapp_inbound_messages` via Supabase MCP; a controlled send test for the access token) →
when green, posts a closure report and stops; when not, reports exactly which step above is outstanding
and reschedules. It must run as a **cloud scheduled routine** (nested `claude -p` has no auth here);
fallback is a GitHub Actions `workflow_dispatch` running the deterministic deploy+validate steps.
