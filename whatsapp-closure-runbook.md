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
> logging does **not** depend on it — to test now, seed a verified link directly (service role).
> Since audit S1 (2026-09-08) the link lives in **`whatsapp_identities`**. The old `profiles.phone_*`
> columns are blocked for clients and are **no longer read** by the webhook, so updating them links
> nothing:
> ```sql
> insert into public.whatsapp_identities (profile_id, phone_number, household_id, verified_at)
> values ('<auth_uid>', '<E164 digits, no +>', '<household_uuid>', now())
> on conflict (profile_id) do update
>   set phone_number = excluded.phone_number, household_id = excluded.household_id, verified_at = now();
> ```

## 2. Activate PROACTIVE templates (partner-split, budget/bill alerts, digests)
Each is **inert** until BOTH are true. Add a template name to the allowlist only once Meta shows it **Approved**.
```bash
supabase secrets set \
  WHATSAPP_OUTBOUND_ENABLED=1 \
  WHATSAPP_APPROVED_TEMPLATES="partner_split_prompt,split_shared_with_you,split_settled,budget_threshold_alert,bill_due_reminder,large_transaction_alert,recurring_auto_logged,weekly_summary,reengagement_nudge"
```
The app / edge functions call `whatsapp-notify { event, householdId, toProfileId, params, dedupeKey? }`;
it maps the event to its template and dispatches only if enabled + approved (else returns `{skipped, reason}`).

**v10.40.0 guards** (every caller):
- **Callers.** A member's JWT, which needs a write role (owner, admin or member; viewers get 403), or
  the **service key** for scheduled/server jobs.
- **Recipient** must be linked to the same household.
- **Consent (v10.42.0).** Marketing templates go only to people who turned on "Weekly summary and
  balance reminders" in Settings. Insights templates (payday, digest, month close) need their own
  opt-in. A muted topic is skipped (`muted`). Bill reminders and large-spend alerts cannot be muted.
- **Dedupe:** one send per `(event, recipient, dedupeKey)`. `dedupeKey` defaults to the UTC day; pass
  e.g. a schedule id plus due date for per-occurrence events.
- **Cap:** at most `WHATSAPP_DAILY_CAP` (default 6) sends per recipient in any 24 h.
- **Audit rows** carry `status` `sending` → `sent` / `failed` / `skipped`.

**Templates (v10.41.0).** `supabase/functions/_shared/whatsapp-templates.ts` is the manifest of
every template Vyact sends, matching what Meta approved (`docs/WHATSAPP_TEMPLATES.md`).

To switch a template on:
1. Wait until it is **Approved** in WhatsApp Manager.
2. Run `node --experimental-strip-types scripts/whatsapp/templates-status.mjs` with
   `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_WABA_ID` in your shell. It must report no drift for that
   template.
3. Add its name to `WHATSAPP_APPROVED_TEMPLATES`.

Image headers are served from `https://vyact.app/whatsapp/<file>.jpg`, so a template's image must
be deployed before it is switched on. To change a template, edit it at Meta (WhatsApp Manager, or
`templates-submit.mjs --apply`, which is a dry run without `--apply`), wait for approval, then update
the manifest in the same change as any send code that depends on it.

**Required secrets** (no in-code fallbacks since v10.40.0 — a missing one fails the send loudly):
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (the live +91 number's ID on WABA
`1887272231954080`), `WHATSAPP_WABA_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`. Optional:
`WHATSAPP_DAILY_CAP`, `VYACT_TZ_OFFSET_MINUTES` (default 330, used to resolve "yesterday").

**The scheduler (v10.42.0).** `pg_cron` calls `whatsapp-dispatch` every 15 minutes (`job=alerts`:
large spends, budget lines at 80%, settled splits) and on Sundays at 18:00 IST (`job=weekly`: the
weekly summary and stale balances, opted-in people only), and daily at 09:00 IST (`job=bills`,
v10.43.0: approval bills due that day; "paid <name>" in reply approves the bill through
`whatsapp_approve_recurring`, which also moves the schedule on). It is **inert** until you set one secret in
two places. Generate a long random value yourself and never paste it into a chat:
1. In the SQL editor: `select vault.create_secret('<your value>', 'whatsapp_dispatch_secret');`
2. `supabase secrets set WHATSAPP_DISPATCH_SECRET=<the same value>`

Each send still needs its template approved and listed. To check a run, look at
`select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;`
and `select id, status_code, content from net._http_response order by created desc limit 5;`. The
response body tallies what was planned, sent and skipped, and why. A manual run is
`POST …/whatsapp-dispatch?job=alerts` with the service key as the bearer. To stop it,
`select cron.unschedule('whatsapp-dispatch-alerts');` (and `…-weekly`).

**Delivery and taps (v10.42.0).** Outbound rows keep Meta's id (`provider_message_id`) and the
furthest status Meta reported (`delivery_status`). STOP / STOP <TOPIC> / START <TOPIC> and the
template buttons change `whatsapp_preferences`.

**Ask Vyact on WhatsApp (v10.45.0).** A question is answered in the chat only when both hold:
1. The person turned answers on (`reads_enabled`): in **Settings › WhatsApp › "Answer my questions
   here"** (`reads_source = 'app_settings'`), or by replying **ANSWERS ON** in the chat
   (`'whatsapp_keyword'`, v10.46.0). ANSWERS OFF turns it off.
2. An `ai_model_configs` row is enabled for the `assistant` seam. The test-only Claude Code relay row
   does not count: WhatsApp needs a real model.

With answers off, a question gets the ANSWERS ON offer (a `reads_offer` pending turn), never a link;
the question is answered as soon as the person says ANSWERS ON. Calls share the app's daily cap
(`ASK_VYACT_DAILY_CALL_CAP`) and appear in `ai_usage` with surface `whatsapp`. The engine is
`_shared/agent/engine.generated.js`, built from the app; rebuild with
`node scripts/build-agent-engine.mjs` after changing Ask Vyact code.
Time zone: the engine uses the runtime's local time, which is UTC on the edge. Between 00:00 and 05:30
IST it would treat "today" as yesterday. Set `supabase secrets set TZ=Asia/Kolkata`, then ask "how much
did I spend today?" after midnight IST to confirm the runtime honours it.

**Inbound replay (v10.40.0).**
- A ledger error marks the inbox row `failed` with `attempts` and `last_error`; it is no longer
  marked `done`.
- Failed rows with fewer than 3 attempts, and claims older than 10 minutes, are replayed on every
  delivery and on `POST …/whatsapp-webhook?mode=sweep` with the service key as the bearer.
- A replay of an entry that did land comes back `duplicate` and stays silent.
- Find stuck rows with
  `select * from whatsapp_inbound_messages where direction='inbound' and status='failed' order by created_at desc;`.

## 3. Validate (what the closure agent checks)
- **Webhook GET:** right token → echoes challenge; wrong token → 403.
  `curl "https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=ok"` → `ok`
- **Signed inbound POST** → `200 {"status":"ok"}` + a `whatsapp_inbound_messages` row with `processed_at` set + a new `transactions` row + a confirmation delivered.
- **DB:** `select proname from pg_proc where proname='whatsapp_log_transaction';` (present), and
  `select count(*) from whatsapp_inbound_messages where processed_at is not null;` climbs as messages flow.
- **Live e2e:** from a linked number send `850 groceries hdfc` → the txn appears in the app for that
  household; send "what's my balance?" → hard-block reply (app link), no data.

## 3b. ✅ VALIDATED 2026-08-15 — MVP inbound logging works end-to-end

**Status:** **DONE / live on the real business number +918897882803** (WABA `1887272231954080`).
Proven: `Groceries hdfc 56` → a real ₹56 Groceries·HDFC transaction; session-text confirmation
delivered; a budget query correctly hard-blocked. Recipient **919740556606** (the number that texts
the business) is seeded-linked to Mallela Household. Closure agent DISABLED; temp `whatsapp-test-send`
fn retired (inert stub).

**THE gotcha (not business verification!):** the number is LIVE/VERIFIED/GREEN/TIER_250 — business
verification never blocked messaging. The dead-end was **two WABAs**: the 9 Vyact templates were
submitted to the OLD test WABA `1690737521937003` (owns only the +1 555 public test number), but the
live business number is on WABA `1887272231954080`. **Templates are per-WABA** → sending them from the
business number = `#132001`. (`hello_world` is Meta-locked to public test numbers = `#131058`.)

**Remaining to finish PROACTIVE sends (logging already works):** the 9 templates are **In review on
`1887272231954080`** — once APPROVED THERE, set `WHATSAPP_OUTBOUND_ENABLED=1` +
`WHATSAPP_APPROVED_TEMPLATES=...`, then wire `whatsapp-notify` triggers to app events (WA-6, code).

<details><summary>Original stalled-state notes (2026-08-10) — superseded, kept for history</summary>

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

</details>

## 4. The closure agent (autonomous finish)
A scheduled Claude routine that, each run: pulls latest → runs the local gate → ensures the migration
is applied + functions deployed (idempotent) → probes readiness (webhook handshake with the real token;
`pg_proc`/`whatsapp_inbound_messages` via Supabase MCP; a controlled send test for the access token) →
when green, posts a closure report and stops; when not, reports exactly which step above is outstanding
and reschedules. It must run as a **cloud scheduled routine** (nested `claude -p` has no auth here);
fallback is a GitHub Actions `workflow_dispatch` running the deterministic deploy+validate steps.
