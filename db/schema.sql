-- ════════════════════════════════════════════════════════════════
-- FinFlow · Cloud schema for Supabase (Postgres 15+)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════════

-- ── EXTENSIONS ────────────────────────────────────────────────
create extension if not exists pgcrypto;     -- gen_random_uuid()
create extension if not exists pg_trgm;      -- search

-- ════════════════════════════════════════════════════════════════
-- 1. PROFILES (extends auth.users)
-- ════════════════════════════════════════════════════════════════
create table if not exists profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  avatar_url        text,
  default_currency  text not null default 'USD',
  language          text not null default 'en',
  date_format       text not null default 'us',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ════════════════════════════════════════════════════════════════
-- 2. HOUSEHOLDS (workspaces — family / business / personal)
-- ════════════════════════════════════════════════════════════════
create table if not exists households (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  type              text not null check (type in ('family','business','personal','shared')),
  base_currency     text not null default 'USD',
  language          text default 'en',
  payoff_strategy   text default 'avalanche' check (payoff_strategy in ('avalanche','snowball')),
  extra_payment     numeric(15,2) default 0,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists households_created_by_idx on households(created_by);

-- ════════════════════════════════════════════════════════════════
-- 3. MEMBERSHIPS (user × household, with role)
-- ════════════════════════════════════════════════════════════════
create table if not exists memberships (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete cascade,  -- NULL for non-authed members (e.g. children)
  role              text not null check (role in ('owner','admin','member','viewer','child')),
  display_name      text not null,
  household_role    text check (household_role in ('primary','partner','child','elder')),
  joined_at         timestamptz not null default now(),
  unique (household_id, user_id)
);
create index if not exists memberships_household_idx on memberships(household_id);
create index if not exists memberships_user_idx on memberships(user_id);

-- Auto-create owner membership when a household is created
create or replace function handle_new_household()
returns trigger language plpgsql security definer as $$
begin
  insert into memberships (household_id, user_id, role, display_name, household_role)
  values (
    new.id, new.created_by, 'owner',
    coalesce((select display_name from profiles where id = new.created_by), 'Owner'),
    'primary'
  );
  return new;
end;$$;

drop trigger if exists on_household_created on households;
create trigger on_household_created
  after insert on households
  for each row execute function handle_new_household();

-- ════════════════════════════════════════════════════════════════
-- 4. INVITATIONS
-- ════════════════════════════════════════════════════════════════
create table if not exists invitations (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  invited_email     text not null,
  invited_by        uuid not null references auth.users(id),
  role              text not null check (role in ('admin','member','viewer','child')),
  household_role    text,
  token             text not null unique default encode(gen_random_bytes(24), 'base64url'),
  expires_at        timestamptz not null default (now() + interval '14 days'),
  accepted_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists invitations_token_idx on invitations(token) where accepted_at is null;
create index if not exists invitations_email_idx on invitations(invited_email) where accepted_at is null;

-- ════════════════════════════════════════════════════════════════
-- 5. DOMAIN TABLES (all scoped to household_id)
-- ════════════════════════════════════════════════════════════════

-- TRANSACTIONS
create table if not exists transactions (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  created_by        uuid references auth.users(id),
  member_id         uuid references memberships(id) on delete set null,
  type              text not null check (type in ('income','expense')),
  amount            numeric(15,2) not null check (amount > 0),
  currency          text not null default 'USD',
  date              date not null,
  description       text not null,
  category          text not null,
  note              text,
  recurring         text check (recurring in ('','weekly','monthly','yearly')),
  attachment_url    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz   -- soft delete for sync
);
create index if not exists txns_household_date_idx on transactions(household_id, date desc) where deleted_at is null;
create index if not exists txns_household_member_idx on transactions(household_id, member_id) where deleted_at is null;
create index if not exists txns_household_cat_idx on transactions(household_id, category) where deleted_at is null;
create index if not exists txns_updated_idx on transactions(household_id, updated_at);

-- BUDGETS
create table if not exists budgets (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  category          text not null,
  monthly_limit     numeric(15,2) not null check (monthly_limit > 0),
  currency          text not null default 'USD',
  color             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (household_id, category) where deleted_at is null
);

-- GOALS
create table if not exists goals (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  type              text not null check (type in ('emergency','savings','debt','investment','purchase','custom')),
  name              text not null,
  target_amount     numeric(15,2) not null check (target_amount > 0),
  current_amount    numeric(15,2) not null default 0,
  currency          text not null default 'USD',
  deadline          date,
  completed         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- DEBTS
create table if not exists debts (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  type              text not null,
  name              text not null,
  lender            text,
  account_last4     text check (length(account_last4) <= 4),
  principal         numeric(15,2),
  current_balance   numeric(15,2) not null check (current_balance >= 0),
  interest_rate     numeric(6,3) not null check (interest_rate >= 0 and interest_rate < 100),
  minimum_payment   numeric(15,2) not null check (minimum_payment >= 0),
  due_date          date,
  currency          text not null default 'USD',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- ASSETS
create table if not exists assets (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  type              text not null,
  name              text not null,
  value             numeric(15,2) not null check (value >= 0),
  currency          text not null default 'USD',
  liquidity         text not null check (liquidity in ('liquid','short','long')),
  note              text,
  last_updated      date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- EXCHANGE RATES (per-household — each can override defaults)
create table if not exists exchange_rates (
  household_id      uuid not null references households(id) on delete cascade,
  currency_code     text not null,
  rate_to_usd       numeric(15,6) not null check (rate_to_usd > 0),
  updated_at        timestamptz not null default now(),
  primary key (household_id, currency_code)
);

-- ACTIVITY LOG (audit trail for shared households)
create table if not exists activity_log (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  actor_id          uuid references auth.users(id),
  action            text not null check (action in ('created','updated','deleted','invited','accepted','removed','role_changed','transferred')),
  entity_type       text not null,
  entity_id         uuid,
  changes           jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists activity_household_time_idx on activity_log(household_id, created_at desc);

-- ════════════════════════════════════════════════════════════════
-- 6. updated_at TRIGGERS
-- ════════════════════════════════════════════════════════════════
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  for t in
    select unnest(array['profiles','households','transactions','budgets','goals','debts','assets'])
  loop
    execute format('drop trigger if exists touch_%I on %I', t, t);
    execute format('create trigger touch_%I before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end$$;

-- ════════════════════════════════════════════════════════════════
-- 7. ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════

-- Helper function: is the current user a member of this household?
create or replace function is_member(h_id uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from memberships where household_id = h_id and user_id = auth.uid());
$$;

-- Helper: get current user's role in this household (null if not a member)
create or replace function role_in(h_id uuid)
returns text language sql security definer stable as $$
  select role from memberships where household_id = h_id and user_id = auth.uid() limit 1;
$$;

-- Enable RLS on every table
alter table profiles      enable row level security;
alter table households    enable row level security;
alter table memberships   enable row level security;
alter table invitations   enable row level security;
alter table transactions  enable row level security;
alter table budgets       enable row level security;
alter table goals         enable row level security;
alter table debts         enable row level security;
alter table assets        enable row level security;
alter table exchange_rates enable row level security;
alter table activity_log  enable row level security;

-- ── PROFILES ─────────────────────────────────────────────────
create policy "users read own profile"
  on profiles for select using (id = auth.uid());
create policy "users read profiles of co-members"
  on profiles for select using (
    id in (
      select m2.user_id from memberships m1
      join memberships m2 on m1.household_id = m2.household_id
      where m1.user_id = auth.uid()
    )
  );
create policy "users update own profile"
  on profiles for update using (id = auth.uid());

-- ── HOUSEHOLDS ───────────────────────────────────────────────
create policy "members read household"
  on households for select using (is_member(id));
create policy "anyone create household"
  on households for insert with check (created_by = auth.uid());
create policy "owners update household"
  on households for update using (role_in(id) = 'owner');
create policy "owners delete household"
  on households for delete using (role_in(id) = 'owner');

-- ── MEMBERSHIPS ──────────────────────────────────────────────
create policy "members see other members"
  on memberships for select using (is_member(household_id));
create policy "owners and admins add members"
  on memberships for insert with check (role_in(household_id) in ('owner','admin'));
create policy "owners change roles; admins change non-owners"
  on memberships for update using (
    role_in(household_id) = 'owner'
    or (role_in(household_id) = 'admin' and role != 'owner')
  );
create policy "members leave; owners remove non-owners"
  on memberships for delete using (
    user_id = auth.uid()                                  -- self-removal
    or role_in(household_id) = 'owner'                     -- owner removes anyone
    or (role_in(household_id) = 'admin' and role != 'owner') -- admin removes non-owners
  );

-- ── INVITATIONS ──────────────────────────────────────────────
create policy "owners and admins read invitations"
  on invitations for select using (role_in(household_id) in ('owner','admin'));
create policy "owners and admins send invitations"
  on invitations for insert with check (
    role_in(household_id) in ('owner','admin') and invited_by = auth.uid()
  );
create policy "owners and admins revoke invitations"
  on invitations for delete using (role_in(household_id) in ('owner','admin'));

-- ── TRANSACTIONS / BUDGETS / GOALS / DEBTS / ASSETS ──────────
-- Pattern: read = members; write = non-viewers; child can only edit own
do $$
declare tbl text;
begin
  foreach tbl in array array['transactions','budgets','goals','debts','assets'] loop
    execute format('
      create policy "%1$s_read" on %1$s for select using (is_member(household_id));
      create policy "%1$s_insert" on %1$s for insert with check (role_in(household_id) in (''owner'',''admin'',''member'',''child''));
      create policy "%1$s_update" on %1$s for update using (
        role_in(household_id) in (''owner'',''admin'',''member'')
        or (role_in(household_id) = ''child'' and created_by = auth.uid())
      );
      create policy "%1$s_delete" on %1$s for delete using (
        role_in(household_id) in (''owner'',''admin'',''member'')
        or (role_in(household_id) = ''child'' and created_by = auth.uid())
      );
    ', tbl);
  end loop;
end$$;

-- ── EXCHANGE RATES ───────────────────────────────────────────
create policy "rates_read"   on exchange_rates for select using (is_member(household_id));
create policy "rates_write"  on exchange_rates for all    using (role_in(household_id) in ('owner','admin','member'));

-- ── ACTIVITY LOG ─────────────────────────────────────────────
create policy "log_read"   on activity_log for select using (is_member(household_id));
-- Inserts only via server-side functions (service_role) — no client policy needed

-- ════════════════════════════════════════════════════════════════
-- 8. HELPFUL VIEWS
-- ════════════════════════════════════════════════════════════════

-- A user's households with their role
create or replace view my_households as
  select h.*, m.role, m.display_name as my_display_name, m.household_role
  from households h
  join memberships m on m.household_id = h.id
  where m.user_id = auth.uid();

-- Household summary (counts + totals) for the dashboard
create or replace view household_summary as
  select
    h.id as household_id,
    (select count(*) from memberships where household_id = h.id) as member_count,
    (select count(*) from transactions where household_id = h.id and deleted_at is null) as txn_count,
    (select count(*) from debts where household_id = h.id and deleted_at is null) as debt_count,
    (select coalesce(sum(current_balance), 0) from debts where household_id = h.id and deleted_at is null) as total_debt_native,
    (select count(*) from assets where household_id = h.id and deleted_at is null) as asset_count,
    (select coalesce(sum(value), 0) from assets where household_id = h.id and deleted_at is null) as total_assets_native
  from households h;

grant select on my_households, household_summary to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 9. RPCs — invitation acceptance, ownership transfer, leave household
-- ════════════════════════════════════════════════════════════════

-- Accept an invitation by token. Caller must be authenticated.
-- Validates: token exists, not expired, not already accepted, email matches caller.
-- Atomically: creates membership, marks invitation accepted, writes audit entry.
create or replace function accept_invitation(invite_token text)
returns jsonb
language plpgsql
security definer
as $$
declare
  inv record;
  caller_email text;
  new_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to accept an invitation';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select * into inv from invitations
    where token = invite_token and accepted_at is null
    limit 1;

  if inv is null then raise exception 'Invitation not found or already accepted'; end if;
  if inv.expires_at < now() then raise exception 'Invitation expired'; end if;
  if lower(inv.invited_email) <> lower(caller_email) then
    raise exception 'Invitation was sent to %, but you are signed in as %', inv.invited_email, caller_email;
  end if;
  -- Already a member?
  if exists (select 1 from memberships where household_id = inv.household_id and user_id = auth.uid()) then
    update invitations set accepted_at = now() where id = inv.id;
    return jsonb_build_object('household_id', inv.household_id, 'already_member', true);
  end if;

  insert into memberships (household_id, user_id, role, display_name, household_role)
  values (inv.household_id, auth.uid(), inv.role,
          coalesce((select display_name from profiles where id = auth.uid()),
                   split_part(caller_email, '@', 1)),
          inv.household_role)
  returning id into new_membership_id;

  update invitations set accepted_at = now() where id = inv.id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id)
  values (inv.household_id, auth.uid(), 'accepted', 'invitation', inv.id);

  return jsonb_build_object(
    'household_id', inv.household_id,
    'membership_id', new_membership_id,
    'role', inv.role
  );
end;
$$;

grant execute on function accept_invitation(text) to authenticated;

-- Transfer ownership of a household. Only an existing owner may call.
-- Promotes target to owner, demotes caller to admin.
create or replace function transfer_ownership(h_id uuid, to_user uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  caller_role text;
  target_membership uuid;
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;

  select role into caller_role from memberships
    where household_id = h_id and user_id = auth.uid();
  if caller_role <> 'owner' then
    raise exception 'Only the owner can transfer ownership';
  end if;

  select id into target_membership from memberships
    where household_id = h_id and user_id = to_user;
  if target_membership is null then
    raise exception 'Target user is not a member of this household';
  end if;

  -- Atomic role swap
  update memberships set role = 'owner' where id = target_membership;
  update memberships set role = 'admin' where household_id = h_id and user_id = auth.uid();

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h_id, auth.uid(), 'transferred', 'membership', target_membership,
          jsonb_build_object('to_user', to_user));

  return true;
end;
$$;

grant execute on function transfer_ownership(uuid, uuid) to authenticated;

-- Leave a household. Owner cannot leave if they are the sole owner —
-- must transfer ownership first.
create or replace function leave_household(h_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  caller_role text;
  owner_count int;
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;

  select role into caller_role from memberships
    where household_id = h_id and user_id = auth.uid();
  if caller_role is null then raise exception 'Not a member of this household'; end if;

  if caller_role = 'owner' then
    select count(*) into owner_count from memberships
      where household_id = h_id and role = 'owner';
    if owner_count <= 1 then
      raise exception 'Sole owner cannot leave — transfer ownership first or delete the household';
    end if;
  end if;

  delete from memberships where household_id = h_id and user_id = auth.uid();

  insert into activity_log (household_id, actor_id, action, entity_type)
  values (h_id, auth.uid(), 'removed', 'membership');

  return true;
end;
$$;

grant execute on function leave_household(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- DONE.  Next step:
--   1. In Supabase: create an Edge Function for sending invite emails
--   2. In your app: drop in @supabase/supabase-js and start migrating
-- ════════════════════════════════════════════════════════════════
