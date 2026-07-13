-- ============================================================================
-- Vyact v10.1.0 — cross-device notifications (Aurora revamp · Batch A).
--
-- Notifications were device-local (localStorage). This makes them a synced,
-- household-scoped entity so the same feed + unread badge appear on every
-- device a member signs in on. Rows are still GENERATED on-device from app
-- state (recurring due, budget thresholds, …) — the client upserts freshly
-- generated notifications (deduped by household_id + dedupe_key) and reads the
-- household's list back. Status changes (read/dismiss) sync too. No secrets,
-- household-scoped RLS mirroring transactions/saved_views.
-- ============================================================================

create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  type          text not null,
  priority      text not null default 'P2' check (priority in ('P1', 'P2')),
  title         text not null,
  body          text,
  status        text not null default 'unread' check (status in ('unread', 'read', 'dismissed')),
  created_at    timestamptz not null default now(),
  due_at        timestamptz,
  member_id     uuid,
  amount_ref    numeric,
  deep_link     text,
  tint          text,
  actions       jsonb,          -- NotifActionSpec[] (id/label/kind)
  context       jsonb,          -- { scheduleId, budgetId, debtId, accountId, txnId, inviteToken }
  dedupe_key    text not null
);

-- One row per (household, occurrence): two devices generating the same
-- notification collapse to a single row (client upserts ignore-duplicates).
create unique index if not exists uq_notif_dedupe on notifications(household_id, dedupe_key);
create index if not exists notif_household_status_idx on notifications(household_id, status);

alter table notifications enable row level security;

drop policy if exists "notif_read"   on notifications;
drop policy if exists "notif_insert" on notifications;
drop policy if exists "notif_update" on notifications;
drop policy if exists "notif_delete" on notifications;

create policy "notif_read"   on notifications for select using (is_member(household_id) or is_admin('roles'));
create policy "notif_insert" on notifications for insert with check (is_member(household_id));
create policy "notif_update" on notifications for update using (is_member(household_id));
create policy "notif_delete" on notifications for delete using (is_member(household_id));

grant select, insert, update, delete on notifications to authenticated;
