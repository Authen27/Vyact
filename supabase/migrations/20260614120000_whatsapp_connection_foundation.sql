-- ============================================================================
-- WhatsApp Business integration — connection foundation
-- (companion: whatsapp-vyact-solutioning.md §3). Forward-only, idempotent.
-- Applied to prod 2026-06-14.
--
-- Scope: the phone-link plug-in + webhook idempotency. NO use-case logic yet.
--   • profiles gets the WhatsApp linkage columns (phone + verified + household).
--   • whatsapp_verification_otps holds hashed OTPs for the link handshake.
--   • whatsapp_inbound_messages is the idempotency + audit log for inbound events.
--   • Both whatsapp_* tables are RLS-enabled with NO client policies → deny-all to
--     anon/authenticated. Edge Functions use the service-role key (bypasses RLS).
-- ============================================================================

-- 1. profiles: WhatsApp linkage
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists phone_verified_at timestamptz;
alter table public.profiles add column if not exists whatsapp_household_id uuid references public.households(id) on delete set null;
create unique index if not exists uq_profiles_phone_number on public.profiles(phone_number) where phone_number is not null;
create index if not exists idx_profiles_wa_household on public.profiles(whatsapp_household_id) where whatsapp_household_id is not null;

-- 2. OTP table (server-side only)
create table if not exists public.whatsapp_verification_otps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  phone_number text not null,
  otp_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_otp_lookup on public.whatsapp_verification_otps(profile_id, phone_number);
alter table public.whatsapp_verification_otps enable row level security;

-- 3. inbound idempotency + audit (used by later use-cases)
create table if not exists public.whatsapp_inbound_messages (
  wa_message_id text primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  direction text not null default 'inbound',
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_inbound_created on public.whatsapp_inbound_messages(created_at desc);
alter table public.whatsapp_inbound_messages enable row level security;
