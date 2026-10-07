-- W1c (v10.64.0) — audit 2026-10-04 BE-FN-06 / INT-HH-11 / XC-PRV-13: split email can no longer
-- be used as a relay.
--
-- Before this, any signed-in user could create a split with any currency text and any number of
-- participant emails, then call send-split-email 'shared' as often as they liked: every call
-- mailed every participant again, from hello@vyact.app, with no record and no cap.
--
--   1. shared_splits.currency is three capital letters (an ISO-4217 code), like every other
--      currency in the app. NOT VALID: new and edited rows are checked; an odd legacy row does
--      not abort the deploy (the email templates drop a malformed code anyway).
--   2. split_email_log: one row per (share, event) ever sent. The unique key IS the dedupe —
--      a second 'shared' call for the same split mails only participants added since.
--      It holds ids and a time, never an address or a body.
--   3. claim_split_emails(): the only way to send. Under a per-sender lock it counts the
--      sender's emails in the last 24 hours, claims at most the remaining room among shares not
--      yet mailed for that event, and returns the claimed share ids. The Edge Function mails
--      exactly those and releases (deletes) a claim whose delivery failed, so it can be retried.
--   4. Shares that existed before this migration are recorded as already mailed for the events
--      they have been through, so the first edit after release does not re-mail old splits.
--
-- Service role only. Members never read or write the log.

update public.shared_splits
   set currency = upper(btrim(currency))
 where currency is distinct from upper(btrim(currency));

alter table public.shared_splits drop constraint if exists ck_shared_split_currency;
alter table public.shared_splits
  add constraint ck_shared_split_currency check (currency ~ '^[A-Z]{3}$') not valid;

create table if not exists public.split_email_log (
  id              bigint generated always as identity primary key,
  sender_user_id  uuid references auth.users(id) on delete cascade,
  split_id        uuid not null references public.shared_splits(id) on delete cascade,
  share_id        uuid not null references public.shared_split_shares(id) on delete cascade,
  event           text not null check (event in ('shared', 'settled', 'closed')),
  created_at      timestamptz not null default now(),
  constraint uq_split_email_once unique (share_id, event)
);

create index if not exists split_email_log_sender_idx on public.split_email_log (sender_user_id, created_at);
create index if not exists split_email_log_split_idx on public.split_email_log (split_id);

alter table public.split_email_log enable row level security;
revoke all on table public.split_email_log from public, anon, authenticated;
grant select, insert, delete on table public.split_email_log to service_role;

-- 4. Existing shares: treat what already happened as already mailed (dated when it happened, so it
--    does not count against anyone's cap today).
insert into public.split_email_log (sender_user_id, split_id, share_id, event, created_at)
select sp.owner_user_id, sp.id, sh.id, 'shared', sh.created_at
  from public.shared_split_shares sh
  join public.shared_splits sp on sp.id = sh.split_id
on conflict (share_id, event) do nothing;

insert into public.split_email_log (sender_user_id, split_id, share_id, event, created_at)
select sh.settled_user_id, sh.split_id, sh.id, 'settled', coalesce(sh.paid_at, sh.created_at)
  from public.shared_split_shares sh
 where sh.paid
on conflict (share_id, event) do nothing;

insert into public.split_email_log (sender_user_id, split_id, share_id, event, created_at)
select sp.owner_user_id, sp.id, sh.id, 'closed', sp.closed_at
  from public.shared_split_shares sh
  join public.shared_splits sp on sp.id = sh.split_id
 where sp.closed_at is not null
on conflict (share_id, event) do nothing;

create or replace function public.claim_split_emails(
  p_sender     uuid,
  p_split      uuid,
  p_event      text,
  p_share_ids  uuid[],
  p_daily_cap  int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used     int;
  v_room     int;
  v_wanted   int;
  v_claimed  uuid[];
begin
  if p_sender is null or p_split is null then
    raise exception 'invalid_claim' using errcode = '22023';
  end if;
  if p_event not in ('shared', 'settled', 'closed') then
    raise exception 'bad_event' using errcode = '22023';
  end if;
  if p_daily_cap is null or p_daily_cap < 0 then
    raise exception 'invalid_cap' using errcode = '22023';
  end if;

  -- One sender at a time: two parallel calls cannot both see the same room under the cap.
  perform pg_advisory_xact_lock(hashtextextended('split_email:' || p_sender::text, 0));

  select count(*) into v_used
    from public.split_email_log
   where sender_user_id = p_sender
     and created_at > now() - interval '24 hours';
  v_room := greatest(p_daily_cap - v_used, 0);

  select count(*) into v_wanted
    from public.shared_split_shares s
   where s.split_id = p_split
     and s.id = any(coalesce(p_share_ids, '{}'))
     and not exists (select 1 from public.split_email_log l where l.share_id = s.id and l.event = p_event);

  with pick as (
    select s.id
      from public.shared_split_shares s
     where s.split_id = p_split
       and s.id = any(coalesce(p_share_ids, '{}'))
       and not exists (select 1 from public.split_email_log l where l.share_id = s.id and l.event = p_event)
     order by s.created_at, s.id
     limit v_room
  ), ins as (
    insert into public.split_email_log (sender_user_id, split_id, share_id, event)
    select p_sender, p_split, pick.id, p_event from pick
    on conflict (share_id, event) do nothing
    returning share_id
  )
  select coalesce(array_agg(share_id), '{}') into v_claimed from ins;

  return jsonb_build_object(
    'claimed', to_jsonb(v_claimed),
    'limited', greatest(v_wanted - coalesce(array_length(v_claimed, 1), 0), 0)
  );
end;
$$;

revoke all on function public.claim_split_emails(uuid, uuid, text, uuid[], int) from public, anon, authenticated;
grant execute on function public.claim_split_emails(uuid, uuid, text, uuid[], int) to service_role;
