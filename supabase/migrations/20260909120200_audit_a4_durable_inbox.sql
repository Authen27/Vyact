-- ============================================================================
-- Audit A4 (2026-09-09) — the WhatsApp inbound pipeline becomes durable and
-- batch-correct.
--
-- BEFORE: the webhook read only `entry[0].changes[0].messages[0]` (every later
-- message in the webhook was DROPPED), did the DB work before ACK, and had no
-- record of WHAT was processed vs pending — a crash after ACK lost the message
-- silently.
--
-- NOW: the webhook records EVERY message as an inbox row (status 'pending')
-- and ACKs immediately. A separate claim step processes rows — atomic claim
-- (status flips pending→claimed only if still pending), so a redelivery or a
-- concurrent worker never double-processes; a failure re-marks 'failed' with a
-- retry count; a success marks 'done'. Nothing is lost after ACK.
-- ============================================================================

BEGIN;

alter table public.whatsapp_inbound_messages
  add column if not exists status text not null default 'pending',
  add column if not exists attempts int not null default 0,
  add column if not exists claimed_at timestamptz,
  add column if not exists last_error text;

-- Claim-ability index: the worker polls pending/claimable rows.
create index if not exists idx_wa_inbound_claim
  on public.whatsapp_inbound_messages (status, created_at)
  where direction = 'inbound';

comment on column public.whatsapp_inbound_messages.status is
  'Audit A4 — pending | claimed | done | failed. Claim is atomic (pending→claimed only if still pending) so concurrent workers and Meta redeliveries never double-process.';

COMMIT;
