-- v10.14.0 — email-based cross-household split sharing.
--
-- A split's OWNER (the person who paid) creates a `shared_splits` row plus one
-- `shared_split_shares` row per participant, keyed by the participant's EMAIL
-- (not a user id — the participant may not have a Vyact account yet). Because
-- Supabase only ever writes a *verified* email into a session's JWT, matching
-- on `auth.jwt()`/`auth.users.email` (never a client-supplied value) is what
-- makes it safe for a participant to see a split they didn't create: nobody
-- can put someone else's email in a row and read as that person, since read
-- access is gated on the CALLER's own verified email, not the row's data.
--
-- If the participant doesn't have an account yet, the row simply sits there —
-- the moment they sign up with that email, `shared_splits_select`/
-- `shared_split_shares_select` (keyed on `my_email()`) start matching and it
-- appears. No backfill needed (spec item 4.1).
--
-- Mutation model:
--   - The OWNER can insert/update/delete their own split + its shares directly
--     (normal owner-checked RLS) — this covers the owner manually marking a
--     participant paid (they said so in person) and closing the split.
--   - A PARTICIPANT has no UPDATE policy at all (only SELECT via email match),
--     so their self-service "I paid my share" goes through `settle_share()`,
--     a SECURITY DEFINER RPC that re-derives the caller's verified email
--     server-side and only ever touches the ONE row that matches it.
--
-- Money-model note: these are IOU/ledger rows, structurally identical in
-- spirit to the existing local `Transaction.split` — they do NOT touch
-- `transactions`/`accounts` and never move spend/income on their own. The
-- owner's own expense/income transaction (already created via the normal
-- Add-Transaction flow) is optionally linked via `txn_id` for display only.
--
-- RLS note — owner-vs-participant checks are SECURITY DEFINER helper
-- functions (`owns_shared_split`/`is_split_participant`), mirroring the
-- codebase's existing `is_member()`/`role_in()` pattern: a naive inline
-- `exists (select 1 from shared_split_shares ...)` on `shared_splits`' own
-- policy, paired with `shared_splits` on `shared_split_shares`' policy,
-- recurses (Postgres re-applies each table's RLS while evaluating the
-- other's), raising `42P17`. Routing the cross-table lookup through a
-- SECURITY DEFINER function breaks the cycle (it runs as the function
-- owner, bypassing RLS internally) — verified live via zero-cost `DO`-block
-- impersonation of three real users before this ever reached a client.
-- `auth.uid()` calls are wrapped `(select auth.uid())` per the Auth RLS
-- Initialization Plan advisory, so it's evaluated once per statement, not
-- once per row.

begin;

-- ── my_email() — the verified-email analogue of is_member()/role_in() ──────
create or replace function public.my_email()
returns text
language sql stable security definer set search_path = public
as $$ select lower(email) from auth.users where id = auth.uid(); $$;

grant execute on function public.my_email() to authenticated;

-- ── shared_splits ────────────────────────────────────────────────────────
create table if not exists shared_splits (
  id                  uuid primary key default gen_random_uuid(),
  owner_user_id       uuid not null references auth.users(id) on delete cascade,
  owner_household_id  uuid not null references households(id) on delete cascade,
  -- Optional link to the owner's OWN transaction row (display only).
  txn_id              uuid references transactions(id) on delete set null,
  description         text not null,
  currency            text not null,
  total_amount        numeric not null check (total_amount > 0),
  txn_type            text not null default 'expense' check (txn_type in ('expense','income')),
  date                date not null,
  closed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists shared_splits_owner_idx on shared_splits(owner_user_id);
create index if not exists shared_splits_household_idx on shared_splits(owner_household_id);

drop trigger if exists touch_shared_splits on shared_splits;
create trigger touch_shared_splits before update on shared_splits
  for each row execute function set_updated_at();

-- ── shared_split_shares ──────────────────────────────────────────────────
create table if not exists shared_split_shares (
  id                uuid primary key default gen_random_uuid(),
  split_id          uuid not null references shared_splits(id) on delete cascade,
  email             text not null,
  share             numeric not null check (share > 0),
  paid              boolean not null default false,
  paid_at           timestamptz,
  settled_user_id   uuid references auth.users(id),
  created_at        timestamptz not null default now()
);

create index if not exists shared_split_shares_split_idx on shared_split_shares(split_id);
create index if not exists shared_split_shares_email_idx on shared_split_shares(email);
create index if not exists shared_split_shares_settled_user_idx on shared_split_shares(settled_user_id);

-- ── RLS helpers (SECURITY DEFINER — break the cross-table recursion) ─────
create or replace function public.owns_shared_split(p_split_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shared_splits sp
    where sp.id = p_split_id and sp.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_split_participant(p_split_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shared_split_shares s
    where s.split_id = p_split_id and s.email = my_email()
  );
$$;

grant execute on function public.owns_shared_split(uuid) to authenticated;
grant execute on function public.is_split_participant(uuid) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table shared_splits enable row level security;
alter table shared_split_shares enable row level security;

drop policy if exists "shared_splits_select" on shared_splits;
drop policy if exists "shared_splits_insert" on shared_splits;
drop policy if exists "shared_splits_update" on shared_splits;
drop policy if exists "shared_splits_delete" on shared_splits;

create policy "shared_splits_select" on shared_splits for select using (
  owner_user_id = (select auth.uid())
  or is_split_participant(id)
);
create policy "shared_splits_insert" on shared_splits for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy "shared_splits_update" on shared_splits for update using (owner_user_id = (select auth.uid()));
create policy "shared_splits_delete" on shared_splits for delete using (owner_user_id = (select auth.uid()));

drop policy if exists "shared_split_shares_select" on shared_split_shares;
drop policy if exists "shared_split_shares_insert" on shared_split_shares;
drop policy if exists "shared_split_shares_owner_update" on shared_split_shares;
drop policy if exists "shared_split_shares_delete" on shared_split_shares;

create policy "shared_split_shares_select" on shared_split_shares for select using (
  email = my_email()
  or owns_shared_split(split_id)
);
-- Only the split's owner can add share rows (at creation time).
create policy "shared_split_shares_insert" on shared_split_shares for insert to authenticated
  with check (owns_shared_split(split_id));
-- Owner can edit/mark-paid directly (e.g. "they paid me in cash"). Participants
-- have NO update policy — their self-settle path is settle_share() below.
create policy "shared_split_shares_owner_update" on shared_split_shares for update using (
  owns_shared_split(split_id)
);
create policy "shared_split_shares_delete" on shared_split_shares for delete using (
  owns_shared_split(split_id)
);

grant select, insert, update, delete on shared_splits to authenticated;
grant select, insert, update, delete on shared_split_shares to authenticated;

-- ── settle_share(share_id) — participant self-service settle ───────────────
-- Re-derives the caller's verified email server-side; only ever touches the
-- ONE row whose email matches. A participant with no UPDATE policy on
-- shared_split_shares cannot reach this any other way.
create or replace function public.settle_share(p_share_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
  v_matched uuid;
begin
  v_email := my_email();
  if v_email is null then
    raise exception 'Must be signed in to settle a split share';
  end if;

  select id into v_matched from shared_split_shares
   where id = p_share_id and email = v_email;

  if v_matched is null then
    raise exception 'Share not found, or it is not yours to settle';
  end if;

  update shared_split_shares
     set paid = true, paid_at = now(), settled_user_id = auth.uid()
   where id = p_share_id;
end;
$$;

grant execute on function public.settle_share(uuid) to authenticated;

commit;
