# FinFlow — Cloud, Auth & Multi-Household Architecture

> Design doc for migrating FinFlow from single-tenant `localStorage` to a multi-tenant cloud platform with proper authentication, multi-household membership, and offline-first sync.

---

## 1 · The shift in one paragraph

Today FinFlow is a **single-tenant, local-only** app — one browser, one dataset, no users. The new model is **multi-tenant**: a `User` is an authenticated identity; a `Household` is a workspace with its own data; a `Membership` is the join between them with a role. A user can belong to **many households** simultaneously (two nuclear families, three businesses, a friend's budget they help with). The active household is selected in the UI; all CRUD scopes to it; data lives in the cloud with a local cache for offline use.

---

## 2 · Why these choices matter

| Requirement | Implication |
|---|---|
| Real auth | Server-managed identity, password resets, email verification, sessions, possibly social login |
| User in N families/businesses | **Many-to-many** model with a join table — not a `family_id` foreign key on the user |
| Add/remove users from a family | Invitation flow with email tokens, role-gated removal, audit trail |
| Cloud sync | A backend, a database, a sync protocol, conflict resolution |
| Offline still works | Optimistic local cache + write queue + reconcile-on-reconnect |
| Family privacy | Per-row authorization — Postgres Row-Level Security or app-layer checks |
| A user's *business* household feels different from their *family* household | `Household.type` discriminator + UI variations |

---

## 3 · Recommended stack — **Supabase**

After comparing the realistic options, **Supabase** is the strongest fit:

| | Supabase | Firebase | Custom (Node + Postgres) |
|---|---|---|---|
| Auth (email/social/magic-link) | ✅ Built-in | ✅ Built-in | 🔨 Build (Auth.js / Lucia) |
| Database | Postgres | Firestore (NoSQL) | Postgres |
| Per-row authorization | ✅ **RLS native** | Rules language | App-layer |
| Realtime | ✅ Postgres LISTEN/NOTIFY | ✅ | 🔨 WebSocket |
| Financial aggregations (SUM, JOIN) | ✅ Real SQL | ❌ Limited | ✅ Real SQL |
| Free tier | 50K MAU, 500MB DB | 50K reads/day | Server cost |
| Vendor lock-in | Low (it's Postgres) | High | None |
| Time-to-MVP | **Days** | Days | Weeks |

**Why Postgres matters for FinFlow specifically:** financial reports are aggregations across thousands of transactions — `SUM`, `GROUP BY month`, `JOIN debts ON household_id`. Firestore's NoSQL query model fights this; Postgres makes it trivial. The Net Worth and Pulse Score logic live happily in SQL views.

**Alternative — local-first with CRDTs (Yjs/Automerge + sync server)** — better for collaborative real-time editing (Figma-style), but overkill for a finance app where edits are rare and conflict windows are seconds. We'd pay complexity tax for a benefit we don't need.

---

## 4 · Data model

### 4.1 Identity & membership

```sql
-- ─── USERS (Supabase manages auth.users automatically) ───
-- auth.users ( id uuid, email, encrypted_password, ... )

-- ─── PROFILES — public-facing user info ───
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  avatar_url      text,
  default_currency text default 'USD',
  language        text default 'en',
  date_format     text default 'us',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── HOUSEHOLDS — workspaces (family OR business OR personal) ───
create table households (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            text not null check (type in ('family','business','personal','shared')),
  base_currency   text not null default 'USD',
  language        text default 'en',
  created_by      uuid not null references auth.users(id),
  payoff_strategy text default 'avalanche',
  extra_payment   numeric default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── MEMBERSHIPS — the many-to-many join with role ───
create table memberships (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('owner','admin','member','viewer','child')),
  display_name    text,             -- "Dad" in family A, "Alex" in business B
  household_role  text,             -- 'primary'|'partner'|'child'|'elder' (FinFlow's existing concept)
  joined_at       timestamptz default now(),
  unique(household_id, user_id)
);

create index on memberships(user_id);
create index on memberships(household_id);

-- ─── INVITATIONS — pending invites by email ───
create table invitations (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  invited_email   text not null,
  invited_by      uuid not null references auth.users(id),
  role            text not null,
  household_role  text,
  token           text not null unique,
  expires_at      timestamptz not null default (now() + interval '14 days'),
  accepted_at     timestamptz,
  created_at      timestamptz default now()
);

create index on invitations(token) where accepted_at is null;
create index on invitations(invited_email) where accepted_at is null;
```

### 4.2 Domain tables — all scoped to a household

```sql
create table transactions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  created_by      uuid references auth.users(id),     -- WHO added it
  member_id       uuid references memberships(id),    -- WHOSE expense it represents
  type            text not null check (type in ('income','expense')),
  amount          numeric(15,2) not null,
  currency        text not null default 'USD',
  date            date not null,
  description     text not null,
  category        text not null,
  note            text,
  recurring       text,                                -- '', 'weekly', 'monthly', 'yearly'
  attachment_url  text,                                -- receipts (Supabase Storage)
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index on transactions(household_id, date desc);
create index on transactions(household_id, member_id);
create index on transactions(household_id, category);

-- Same shape for budgets, goals, debts, assets — every table has household_id
create table budgets   ( id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade, /* … */ );
create table goals     ( id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade, /* … */ );
create table debts     ( id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade, /* … */ );
create table assets    ( id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade, /* … */ );

-- Multi-currency rates can be per-household (each household sets its own)
create table exchange_rates (
  household_id    uuid not null references households(id) on delete cascade,
  currency_code   text not null,
  rate_to_usd     numeric not null,
  updated_at      timestamptz default now(),
  primary key (household_id, currency_code)
);

-- Audit log — who changed what, when (essential for shared households)
create table activity_log (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  actor_id        uuid references auth.users(id),
  action          text not null,         -- 'created','updated','deleted','invited','removed_member'
  entity_type     text not null,         -- 'transaction','debt','membership',...
  entity_id       uuid,
  changes         jsonb,                 -- before/after diff
  created_at      timestamptz default now()
);
create index on activity_log(household_id, created_at desc);
```

### 4.3 Why `member_id` references `memberships` (not `auth.users`)

A child without their own account can still be the **subject** of transactions. Memberships have a `display_name` that works for non-authed members ("Mia", a 6-year-old). The `created_by` field always points to a real authed user — the *person who logged it*.

---

## 5 · Row-Level Security (the multi-tenant safety net)

RLS makes Postgres enforce permissions even if your app code has bugs. The basic shape:

```sql
alter table transactions enable row level security;

-- Read: any member of the household
create policy "members read txns"
  on transactions for select
  using (
    household_id in (select household_id from memberships where user_id = auth.uid())
  );

-- Insert: members and above (no viewers)
create policy "non-viewers insert txns"
  on transactions for insert
  with check (
    household_id in (
      select household_id from memberships
      where user_id = auth.uid() and role in ('owner','admin','member','child')
    )
  );

-- Update: members can edit; children only their own
create policy "members update txns"
  on transactions for update
  using (
    household_id in (
      select household_id from memberships
      where user_id = auth.uid()
      and (role in ('owner','admin','member')
           or (role = 'child' and created_by = auth.uid()))
    )
  );

-- Delete: members and above; children can delete their own
create policy "delete txns"
  on transactions for delete
  using (
    household_id in (
      select household_id from memberships
      where user_id = auth.uid()
      and (role in ('owner','admin','member')
           or (role = 'child' and created_by = auth.uid()))
    )
  );
```

Same pattern for every domain table. Memberships table has special policies — only owners/admins can `insert`/`delete`, and **owners can never be removed except by themselves**.

---

## 6 · Permissions matrix

| Action | Owner | Admin | Member | Viewer | Child |
|---|---|---|---|---|---|
| View household data | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) |
| Add transaction | ✓ | ✓ | ✓ | ✗ | ✓ (own) |
| Edit any transaction | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit own transaction | ✓ | ✓ | ✓ | ✗ | ✓ |
| Manage budgets/goals/debts/assets | ✓ | ✓ | ✓ | ✗ | ✗ |
| Invite member | ✓ | ✓ | ✗ | ✗ | ✗ |
| Remove non-owner member | ✓ | ✓ | ✗ | ✗ | ✗ |
| Remove owner | self only | ✗ | ✗ | ✗ | ✗ |
| Promote to admin | ✓ | ✗ | ✗ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete household | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit household settings | ✓ | ✓ | ✗ | ✗ | ✗ |

**Children's view** is filtered: they see their own categories (allowance, school) and shared family categories (groceries) but not adult-private categories (mortgage, salary).

---

## 7 · Sync strategy — offline-first with last-write-wins

For family finance, edits are rare and rarely conflict (people edit different transactions). A full CRDT model is overkill. Use this instead:

### 7.1 Local cache structure (replaces today's `localStorage`)

```
ff_cache:<household_id>   { transactions:[], budgets:[], goals:[], ... }
ff_queue:<household_id>   [{ op, entity, id, payload, ts }, ...]
ff_session                 { user_id, access_token, refresh_token }
ff_active_household        <household_id>
```

### 7.2 Read path
1. On render: paint from local cache **immediately** (fast, offline-resilient)
2. In background: `select * from transactions where household_id = X and updated_at > local_high_watermark`
3. Merge incoming → local cache → re-render

### 7.3 Write path
1. Optimistic update — write to local cache, render
2. Append to local queue with `op` (`upsert` / `delete`), `entity`, `id`, `payload`, client timestamp
3. Try to flush queue — POST to Supabase
4. On success: drop from queue, update high-watermark with server timestamp
5. On failure: keep in queue, retry on next online event

### 7.4 Conflict resolution
- **Per-row last-write-wins by `updated_at`** — sufficient for 99% of household cases
- **Soft-delete with `deleted_at`** — a delete from device A reaches device B even if B has stale local data
- **Optimistic locking** for critical transitions (member role changes, ownership transfer): use a `version` column

### 7.5 Realtime
Supabase Realtime subscriptions stream `INSERT/UPDATE/DELETE` events for the active household. When Sam adds a transaction in their browser, it appears in Alex's browser within ~1 second — no polling.

```js
supabase
  .channel(`household:${householdId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', filter: `household_id=eq.${householdId}` },
      payload => mergeIntoCache(payload))
  .subscribe();
```

---

## 8 · Auth flows

| Flow | UX |
|---|---|
| Sign up | Email + password; verification email; profile creation; create or join first household |
| Sign in | Email + password; OR magic link (passwordless); OR Google/Apple OAuth |
| Password reset | Email with token; new password form |
| Session refresh | Silent — JWT auto-refresh via Supabase client |
| Sign out | Local cache and queue preserved (re-syncable next sign-in) — but optionally cleared for shared computers |
| Email change | Verify both old and new email (Supabase built-in) |
| Anonymous mode | **Keep working** — non-authed users use localStorage as today; sign-up offers to migrate |

**Recommendation:** ship email + magic-link first. Add Google OAuth in week 2. Apple Sign-In is required for App Store later.

---

## 9 · The household switcher (the multi-household UX)

Replace today's plan badge in the sidebar header with:

```
┌──────────────────────────────┐
│ 👨‍👩‍👧‍👦 Smith Family        ▾  │  ← clicked, opens dropdown
├──────────────────────────────┤
│ 👨‍👩‍👧‍👦 Smith Family    Owner │
│ 🏢 Acme Consulting    Admin │
│ 👵 Mom's Household    Viewer│
│ ─────────────────────────── │
│ + Create new household      │
│ ✉️ Accept invitation         │
└──────────────────────────────┘
```

Switching is instant — load that household's cache, swap state, re-render. Each household has its own complete state (members, debts, currency, theme override).

---

## 10 · Invitation flow

```
Owner ─[1]─► Settings → Members → "Invite by email"
                   │
                   └─►  POST /invitations  { email, role, householdRole }
                                    │
                                    ▼
                       INSERT invitations + send email via Supabase Edge Function
                                    │
   ┌────────────────────────────────┘
   ▼
Recipient's inbox: "Sam invited you to Smith Family on FinFlow"
                                    │
                                    ▼
                         Click → finflow.app/invite/<token>
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
     Already signed in                           Not signed in
            │                                               │
            ▼                                               ▼
     POST /invitations/accept             Sign up / sign in flow → then accept
            │
            ▼
     INSERT membership; UPDATE invitation.accepted_at
            │
            ▼
     Active household auto-switches to the new one
```

**Edge cases handled:**
- Token expired → "This invitation expired. Ask for a new one."
- Email mismatch → "This was sent to alex@example.com. Sign in as that user."
- Already a member → "You're already in this household." → switch to it
- Owner removes themself when they're the sole owner → "Transfer ownership first or delete the household."

---

## 11 · Migration from local-only to cloud

The existing `localStorage` users must not be broken. Migration path:

```
First load after deploy
       │
       ▼
Has localStorage data? ──No──► Show landing → sign up / sign in / continue anonymously
       │
       Yes
       ▼
Show banner: "Save your data to the cloud — sign up to back it up and sync across devices"
       │
       ├─ User dismisses → keep working in anonymous mode (localStorage as today)
       │
       └─ User signs up
                │
                ▼
       Auto-create household: "{name}'s Household" with type=family
       Push localStorage → Supabase via batch insert
       Mark localStorage with { migrated: true, household_id }
       Future writes go to cloud, localStorage becomes the cache
```

Anonymous mode stays — it's actually a competitive advantage for privacy-conscious users and demos.

---

## 12 · Phased build plan

| Phase | Scope | Time |
|---|---|---|
| **0 · Refactor** | Wrap all current state mutations in a `dataAdapter` interface — `LocalStorageAdapter` is the only impl. App talks to adapter only. | 2 days |
| **1 · Auth foundation** | Supabase project, schema, RLS, sign-up/sign-in modal, profile page, session management, anonymous mode preserved | 1 week |
| **2 · Single-household cloud** | `SupabaseAdapter` impl, first-sign-in migration, all CRUD against cloud, realtime subscriptions | 1 week |
| **3 · Multi-household** | Household switcher, create/join household, invitations CRUD + email | 1 week |
| **4 · Roles & permissions** | UI gates, RLS verification, role change UI, ownership transfer, member removal | 4 days |
| **5 · Sync hardening** | Offline queue, conflict resolution, optimistic UI, retry logic | 4 days |
| **6 · Activity log + polish** | Audit log UI, "Sam added X" toasts, email notifications digest | 3 days |

**Total: 4–5 weeks for a single capable engineer.** Faster with a backend specialist.

---

## 13 · The data-adapter abstraction (build this first)

Don't sprinkle Supabase calls throughout the codebase. Define one interface:

```js
// dataAdapter.js — interface
class DataAdapter {
  async getHousehold(id) {}
  async listHouseholds() {}
  async createHousehold(name, type) {}

  async listTransactions(householdId, filters) {}
  async upsertTransaction(householdId, txn) {}
  async deleteTransaction(householdId, id) {}
  // ... same shape for budgets, goals, debts, assets, members

  async listMemberships(householdId) {}
  async invite(householdId, email, role) {}
  async removeMember(householdId, memberId) {}

  subscribe(householdId, callback) {}  // realtime
}

class LocalStorageAdapter extends DataAdapter { /* current behavior */ }
class SupabaseAdapter   extends DataAdapter { /* cloud */ }
class HybridAdapter     extends DataAdapter { /* localCache + supabase + queue */ }
```

The rest of `app.js` calls `adapter.upsertTransaction(...)` and never touches storage directly. **This refactor unlocks everything else.**

---

## 14 · Cost & scale model

| Stage | Households | Cost (Supabase) |
|---|---|---|
| Beta | 0–500 | **Free** (50K MAU, 500MB DB) |
| Growth | 500–10K | ~$25/mo Pro plan |
| Scale | 10K–100K | $599/mo Team or self-host |
| Enterprise | 100K+ | Self-hosted Supabase or custom Postgres |

Self-hosting Supabase is realistic — it's open source, runs on AWS/Fly/Railway, gives full control once volume justifies the ops cost.

---

## 15 · What I'd ship in week 1

A concrete sliver to prove the architecture:

1. ✅ Supabase project + schema + RLS
2. ✅ `dataAdapter` interface with `LocalStorageAdapter` (refactor existing code)
3. ✅ Sign-up / sign-in modal (Supabase Auth UI or custom)
4. ✅ Profile page replaces "Profile" section in Settings
5. ✅ Single-household creation on first sign-in
6. ✅ `SupabaseAdapter` for transactions only (everything else still local)
7. ✅ Manual migration button: "Push my local data to the cloud"

That's a clear demo: sign up, see your existing data sync to the cloud, log in from another device, see the same data. Once that's working, every subsequent collection (budgets, goals, debts, assets) is the same pattern repeated.

---

## 16 · Risks & open questions

| Risk | Mitigation |
|---|---|
| Sensitive financial data in cloud | TLS in transit; Postgres encrypted at rest (Supabase default); optional client-side E2E encryption via libsodium for paranoid users |
| Sole owner forgets password | Email-based recovery; secondary admin acts as escalation (with audit log) |
| Family disputes over ownership | Owner can transfer ownership but can't be force-removed; deletion requires unanimous owner consent |
| Cross-household data leak | RLS policies tested, audit log reviewed, security review before launch |
| Email deliverability for invites | Supabase uses managed provider; can swap to Resend / Postmark / SES |
| GDPR / data residency | Supabase has EU regions; right-to-export = JSON backup feature already exists; right-to-delete = `delete from households cascade` |
| Children's data (COPPA) | Children don't have auth accounts; their data is owned by the household owner; documented in Privacy policy |

---

## 17 · Recommended next concrete actions

1. **Spin up a Supabase project** (free, ~5 min)
2. **Run the schema** in the SQL editor (file: `db/schema.sql` — to be created)
3. **Refactor `app.js`** to call a `dataAdapter` (no functional change, but unblocks everything)
4. **Build `SupabaseAdapter` for transactions** only (proof of architecture)
5. **Add the auth modal** (Supabase Auth UI is one component) and household switcher
6. **Iterate** through every other collection on the same pattern

The current vanilla-JS / no-build-step constraint stays — Supabase has a UMD bundle (`@supabase/supabase-js`) that drops in via `<script>` tag. No bundler required.

---

## TL;DR

- **Stack:** Supabase (Postgres + Auth + RLS + Realtime).
- **Model:** `users ⟷ memberships ⟷ households` — many-to-many, role on the join.
- **Data:** every domain row carries `household_id`; RLS enforces access.
- **Sync:** local cache + write queue + Realtime — offline works, online is fast.
- **Migration:** anonymous mode preserved; sign-up offers to push localStorage to the cloud.
- **Build order:** adapter abstraction → auth → single household → multi-household → invites → roles → realtime polish.
- **Time:** 4–5 weeks for an MVP that supports a user belonging to multiple families/businesses with proper auth, invitations, and cloud sync.
