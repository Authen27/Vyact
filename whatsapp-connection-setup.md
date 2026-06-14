# WhatsApp Business — Connection Setup & Validation Runbook

**Scope:** the *connection foundation* only — establishing the Meta ↔ Vyact link and
the per-user phone-link plug-in. Workflow use-cases (logging transactions over chat)
come later and are out of scope here. Companion design: `whatsapp-vyact-solutioning.md`.

**What ships in this phase**
- DB: `profiles.phone_number / phone_verified_at / whatsapp_household_id`, plus
  `whatsapp_verification_otps` and `whatsapp_inbound_messages` (RLS-locked, service-role only).
  Migration: `supabase/migrations/20260614120000_whatsapp_connection_foundation.sql`.
- Edge Functions (`supabase/functions/`): `whatsapp-webhook` (validation handshake +
  signed inbound ack), `whatsapp-send-otp`, `whatsapp-verify-otp`.
- App: **Settings → WhatsApp** panel (`components/settings/WhatsAppLink.tsx`) — the
  send-code → verify → linked plug-in.

---

## 1. Meta / WhatsApp Business account configuration (do this first)

### 1.1 App + product
1. **Meta App** — create a *Business*-type app at <https://developers.facebook.com>.
2. **Add the WhatsApp product** to the app.
3. **WhatsApp Business Account (WABA)** — create or attach one; complete Business
   Verification (this can take **days** — start early; it gates production sending).

### 1.2 Credentials to capture (each maps to a Supabase secret)
| Meta value | Where in dashboard | Supabase secret |
| :-- | :-- | :-- |
| **Phone Number ID** (the sender; *not* the WABA ID) | WhatsApp → API Setup | `WHATSAPP_PHONE_NUMBER_ID` |
| **System User permanent token** (perms: `whatsapp_business_messaging`, `whatsapp_business_management`) | Business Settings → System Users | `WHATSAPP_ACCESS_TOKEN` |
| **App Secret** | App → Settings → Basic | `WHATSAPP_APP_SECRET` |
| **Verify token** (you invent a random string) | used in the webhook handshake | `WHATSAPP_VERIFY_TOKEN` |
| **OTP pepper** (optional; random string) | server-side OTP hashing | `WHATSAPP_OTP_PEPPER` |

> The Client/App **ID** is not sensitive; the **App Secret** and **Access Token**
> are — they live **only** in Supabase secrets, never in the repo or `.env` commits.

Set them:
```bash
supabase secrets set \
  WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_APP_SECRET=... WHATSAPP_VERIFY_TOKEN=... WHATSAPP_OTP_PEPPER=...
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
```

### 1.3 Message templates (submit for approval — approval is external lead time)
For **this connection phase only one template is required**:

| Template | Category | Language | Body | Variables |
| :-- | :-- | :-- | :-- | :-- |
| `phone_verification_otp` | **AUTHENTICATION** (or UTILITY) | en_US | `Your Vyact verification code is {{1}}. It expires in 10 minutes.` | `{{1}}` = code |

> For the later workflow phase you'll also want: `transaction_logged_success`,
> `partner_split_prompt`, `transaction_error_feedback`, `security_alert_unregistered`
> (see the solutioning doc §2). Submit them early since approval can take days.

### 1.4 Webhook
- **Callback URL:** `https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-webhook`
- **Verify token:** the same string you set as `WHATSAPP_VERIFY_TOKEN`.
- **Subscribe to field:** `messages` (covers inbound text, button replies, status events).

---

## 2. Deploy the Edge Functions

```bash
supabase functions deploy whatsapp-webhook   --no-verify-jwt   # Meta has no Supabase JWT
supabase functions deploy whatsapp-send-otp                     # caller is the authed app user
supabase functions deploy whatsapp-verify-otp
```
(Or wire these into `.github/workflows/deploy.yml` as a `deploy-edge-functions` job —
see solutioning doc §12.)

⚠ `whatsapp-webhook` **must** be `--no-verify-jwt`; the other two **must not** be
(they require the user's JWT to identify the profile).

---

## 3. Validation procedure

### 3.1 Validate the webhook connection (Meta ↔ Vyact)
**A — In the Meta dashboard:** click **Verify and save** on the webhook. Meta sends a
GET with `hub.verify_token`; the function echoes `hub.challenge` only when the token
matches. A green check = the callback URL is validated.

**B — Manually (reproduces Meta's handshake):**
```bash
# Correct token → echoes the challenge (200):
curl "https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
# → test123

# Wrong token → 403 Forbidden:
curl -i ".../whatsapp-webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test123"
# → HTTP/1.1 403
```

**C — Signature rejection (inbound POST):** an unsigned/incorrectly-signed POST is
rejected `401`:
```bash
curl -i -X POST ".../whatsapp-webhook" -H "Content-Type: application/json" -d '{"x":1}'
# → HTTP/1.1 401 Invalid signature
```
A genuinely Meta-signed inbound message returns `200 {"status":"ok"}` and lands a row
in `whatsapp_inbound_messages`.

### 3.2 Validate the user phone-link plug-in (end-to-end)
This is the real proof that outbound sending + the token + the WABA all work.
1. Sign in to Vyact (cloud mode) → **Settings → WhatsApp**.
2. Enter a WhatsApp-capable number (with country code) + pick a household → **Send code**.
3. You receive the `phone_verification_otp` message on WhatsApp.
4. Enter the 6 digits → **Verify & link** → panel shows **✅ Linked +<number> → <household>**.

### 3.3 Validate at the data layer
```sql
-- link recorded on the profile
select phone_number, phone_verified_at, whatsapp_household_id
from profiles where id = '<your-auth-uid>';
-- used OTPs are purged after success
select count(*) from whatsapp_verification_otps where profile_id = '<your-auth-uid>';  -- 0
-- the whatsapp_* tables are RLS-on with no client policies (deny-all to clients)
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename like 'whatsapp_%';
```

---

## 4. Security / design notes baked into this phase
- **OTP**: 6-digit CSPRNG, SHA-256 hashed with phone + server pepper, 10-min TTL,
  **max 5 verify attempts** then purge, **60s resend cooldown**, constant-time compare.
- **Webhook**: constant-time HMAC verification of `X-Hub-Signature-256`; **ack-first**
  (records then returns 200) so a slow downstream never causes Meta retry storms.
- **Phone uniqueness**: a number can be linked to only one verified profile
  (`uq_profiles_phone_number`); attempting to link a taken number returns `409`.
- **Least privilege**: the two `whatsapp_*` tables are RLS-enabled with **no** client
  policies — only the service-role Edge Functions can touch them.
- **No secrets in code**: every credential is read from Supabase secrets at runtime.

---

## 5. Advisory — configurations to design for the upcoming business cases
When the workflow phase begins, the WhatsApp Business account will additionally need:
- **Templates** for each outbound moment (confirmation, partner-split prompt with
  interactive buttons, error feedback, unregistered-sender alert) — all pre-approved.
- **Interactive message** capability for the partner-split buttons (button reply
  webhooks arrive on the same `messages` subscription).
- **Conversation category awareness**: utility vs. authentication vs. marketing
  templates are billed and rate-limited differently — keep transactional flows on
  **utility/authentication**.
- **Opt-in record**: capture explicit user consent at link-time (we already gate on a
  verified link); keep an auditable opt-in for compliance.
- **Messaging limits / quality rating**: new numbers start at a low tier (e.g. 250/day)
  and scale with quality — fine for the link OTP, but plan ramp for broad rollout.
- **Privacy posture (MVP++ only)**: the deterministic MVP parser keeps data on-server;
  the Gemini path needs a consent string + DPA-covered tier before enabling (see
  solutioning doc §13.3).
