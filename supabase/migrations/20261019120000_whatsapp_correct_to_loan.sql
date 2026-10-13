-- A WhatsApp "no, that was loan emi" correction becomes a real loan payment (BE-WA-08, INT-TXN-07;
-- owner decisions 13 Oct 2026).
--
-- What was wrong: whatsapp_correct_last re-categorised the entry WhatsApp had just logged to any
-- category, Loan / EMI included. A ₹15,000 expense relabelled as Loan / EMI stayed one plain expense:
-- the whole amount counted as spending and the loan's outstanding never moved, so Debts, the loan's
-- schedule and the budget disagreed with what was paid.
--
-- Now:
--   1. whatsapp_correct_to_loan turns that entry into a payment on the loan the person chose, in ONE
--      transaction: the payment goes through loan_payment_core (W4e: interest first, then principal, the
--      instalment's rules, the next due date and the months left), and the plain expense is
--      soft-deleted. Its operation id is the entry, so it can never be paid twice. A refusal (more than
--      the instalment due, a part-paid instalment, a paid-off loan, no account) changes nothing and is
--      returned with its figure for the reply. It acts only on the entry WhatsApp logged for this
--      person in the last 15 minutes (whatsapp_last_logged), like UNDO.
--   2. whatsapp_correct_last refuses 'loan_emi' (status 'use_loan_payment'): defence in depth; the
--      webhook routes an EMI correction to (1).
--   3. A new pending question, 'emi_loan_choice': "Which loan?" when the household has several and the
--      message names none.
--
-- MONEY MODEL: one loan payment (an interest expense + a principal transfer into the loan account,
-- the W4e shape) replaces one plain expense of the same amount, date and paying account. Nothing else.

BEGIN;

alter table public.whatsapp_pending_turns drop constraint if exists ck_wa_pending_kind;
alter table public.whatsapp_pending_turns add constraint ck_wa_pending_kind
  check (kind in ('missing_amount', 'duplicate_check', 'chips', 'reads_offer', 'name_entries', 'balance_update',
                  'emi_loan_choice'));

create or replace function public.whatsapp_correct_to_loan(
  p_profile_id    uuid,
  p_household_id  uuid,
  p_debt_id       uuid,
  p_wa_message_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_block  text;
  l        record;
  t        public.transactions%rowtype;
  d        public.debts%rowtype;
  v_member uuid;
  v_result jsonb;
  v_code   text;
  v_detail text;
begin
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  select * into l from public.whatsapp_last_logged(p_profile_id, p_household_id, p_wa_message_id);
  if l.reason is not null then return jsonb_build_object('status', l.reason); end if;

  select * into t from public.transactions where id = l.txn_id;
  if t.type is distinct from 'expense' then return jsonb_build_object('status', 'not_an_expense'); end if;
  select * into d from public.debts
   where id = p_debt_id and household_id = p_household_id and deleted_at is null;
  if not found then return jsonb_build_object('status', 'error', 'reason', 'debt_unavailable'); end if;
  select id into v_member from public.memberships
   where household_id = p_household_id and user_id = p_profile_id limit 1;

  -- The server's split, for the entry's own amount, date and paying account. A refusal is an answer:
  -- the payment's savepoint rolls back and the entry stays as it was.
  begin
    v_result := public.loan_payment_core(p_profile_id, md5('wa-correct-emi:' || t.id::text)::uuid, d.id, 'emi',
      t.amount, t.date, t.account_id, v_member, null, null, null, null);
  exception when sqlstate '22023' or sqlstate '42501' then
    get stacked diagnostics v_code = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('status', 'refused', 'reason', v_code, 'figure', nullif(v_detail, ''),
      'loan', d.name, 'amount', t.amount, 'currency', t.currency);
  end;

  -- The plain expense goes: the payment above replaces it (one entry, never both).
  update public.transactions set deleted_at = now() where id = t.id;
  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('undone', now(),
           'converted_to_loan', jsonb_build_object('debt_id', d.id, 'operation_id', v_result->>'operation_id'))
   where wa_message_id = l.inbox_id;
  return v_result || jsonb_build_object('loan', d.name, 'amount', t.amount, 'currency', t.currency);
end;
$$;

revoke all on function public.whatsapp_correct_to_loan(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.whatsapp_correct_to_loan(uuid, uuid, uuid, text) to service_role;

-- Body as 20260928120000 (W3), plus: an EMI is never a category change.
create or replace function public.whatsapp_correct_last(
  p_profile_id uuid, p_household_id uuid, p_category text, p_wa_message_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_block text; l record; v_type text; t record;
begin
  -- An EMI pays a loan (whatsapp_correct_to_loan); relabelling a plain expense would book it whole as
  -- spending and leave the loan untouched.
  if p_category = 'loan_emi' then return jsonb_build_object('status', 'use_loan_payment'); end if;
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  select * into l from public.whatsapp_last_logged(p_profile_id, p_household_id, p_wa_message_id);
  if l.reason is not null then return jsonb_build_object('status', l.reason); end if;

  select type into v_type from public.transactions where id = l.txn_id;
  -- Only an expense or an income carries a category; the caller checked the id is
  -- one of that type's categories.
  if v_type not in ('expense', 'income') then return jsonb_build_object('status', 'no_category'); end if;
  update public.transactions set category = p_category
   where id = l.txn_id returning amount, currency, type, category, updated_at into t;
  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('corrected_at', t.updated_at)
   where wa_message_id = l.inbox_id;
  return jsonb_build_object('status', 'corrected', 'transaction_id', l.txn_id,
    'amount', t.amount, 'currency', t.currency, 'type', t.type, 'category_id', t.category);
end;
$$;

revoke all on function public.whatsapp_correct_last(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_correct_last(uuid, uuid, text, text) to service_role;

COMMIT;
