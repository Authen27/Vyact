#!/usr/bin/env node
// Audit-fix static migration validator.
// db/schema.sql is the regenerated concat of every migration in order — the
// effective schema. This script asserts that every table / column / function /
// policy the NEW audit migrations (2026-09-08 / 2026-09-09) reference actually
// exists in that schema with the shape the migration assumes. It is a static
// stand-in for the Lane B live validation (which needs a service-role key not
// available in this environment): it catches "referenced a column that doesn't
// exist" / "dropped a signature that was never created" / "granted to a role
// that isn't used" — the classes that break `supabase db push` or the runtime.
//
// Run: node scripts/validate-new-migrations.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = fs.readFileSync(path.join(root, 'db', 'schema.sql'), 'utf8');

let failures = 0;
let checks = 0;

function ok(cond, label) {
  checks += 1;
  if (cond) { console.log(`  ✓ ${label}`); }
  else { failures += 1; console.error(`  ✗ ${label}`); }
}
function has(re, label) { ok(re.test(schema), label); }
function section(name) { console.log(`\n${name}`); }

// Helper: is `name` a table the schema creates?
const tableExists = (t) =>
  new RegExp(`create table if not exists (?:public\\.)?${t}\\b`, 'i').test(schema);
// Helper: does table `t` carry column `c` (any later `alter table … add column … c`)?
const columnExists = (t, c) => {
  const addCol = new RegExp(`alter table (?:public\\.)?${t}\\b[\\s\\S]{0,400}?add column if not exists ${c}\\b`, 'i').test(schema);
  const inCreate = (() => {
    const m = schema.match(new RegExp(`create table if not exists (?:public\\.)?${t}\\b[\\s\\S]*?\\);`, 'i'));
    return m ? new RegExp(`\\b${c}\\b`, 'i').test(m[0]) : false;
  })();
  return addCol || inCreate;
};
// Helper: is a function (by name) defined anywhere?
const fnExists = (f) => new RegExp(`function (?:public\\.)?${f}\\b`, 'i').test(schema);

// ── Baseline objects the new migrations build ON ────────────────────────────
section('Baseline objects the new migrations build on');
for (const t of ['profiles', 'households', 'memberships', 'transactions', 'accounts',
                 'budgets', 'budget_allocations', 'debts', 'assets', 'ai_usage',
                 'whatsapp_inbound_messages', 'whatsapp_verification_otps', 'shared_splits']) {
  ok(tableExists(t), `table exists: ${t}`);
}
for (const f of ['role_in', 'is_member', 'erase_household_data', 'whatsapp_log_transaction']) {
  ok(fnExists(f), `function exists: ${f}`);
}
// Columns the new code reads/writes.
has(/add column if not exists phone_number/i, 'profiles.phone_number exists (legacy, trigger-guarded)');
ok(columnExists('households', 'onboarding'), 'households.onboarding exists');
ok(columnExists('transactions', 'account_id'), 'transactions.account_id exists');
ok(columnExists('transactions', 'to_account_id'), 'transactions.to_account_id exists');
ok(columnExists('transactions', 'debt_id'), 'transactions.debt_id exists');
ok(columnExists('transactions', 'member_id'), 'transactions.member_id exists');
ok(columnExists('accounts', 'debt_id'), 'accounts.debt_id exists (F2)');
ok(columnExists('ai_usage', 'outcome'), 'ai_usage.outcome exists');
ok(columnExists('ai_usage', 'backend'), 'ai_usage.backend exists');
ok(columnExists('ai_usage', 'household_id'), 'ai_usage.household_id exists');
ok(columnExists('whatsapp_inbound_messages', 'status'), 'whatsapp_inbound_messages.status exists (A4)');

// ── S1: whatsapp_identities + trigger guard + hardened RPC ──────────────────
section('S1 — whatsapp_identities + profiles guard + hardened writer');
ok(tableExists('whatsapp_identities'), 'whatsapp_identities table created');
has(/create unique index if not exists uq_whatsapp_identities_phone/i, 'uq_whatsapp_identities_phone index');
has(/enable row level security[\s\S]{0,200}?whatsapp_identities/i, 'whatsapp_identities RLS enabled');
ok(fnExists('guard_whatsapp_profile_columns'), 'guard_whatsapp_profile_columns trigger fn');
has(/create trigger trg_guard_whatsapp_profile_columns/i, 'profiles guard trigger created');
// The hardened writer must be the membership-mandatory version.
has(/reason','not_a_member'\)/i, 'whatsapp_log_transaction rejects absent membership');
has(/v_member_role = 'viewer'/, 'whatsapp_log_transaction blocks viewer role');
has(/and deleted_at is null/i, 'whatsapp_log_transaction excludes soft-deleted accounts');

// ── S2: membership role grants ──────────────────────────────────────────────
section('S2 — membership role-grant constraints');
has(/owners and admins add members[\s\S]{0,300}?role_in\(household_id\) = 'owner'[\s\S]{0,120}?role <> 'owner'/i,
  'INSERT policy: admin may not grant owner');
has(/owners change roles; admins change non-owners[\s\S]{0,400}?with check/i,
  'UPDATE policy has a WITH CHECK (no promote-to-owner)');

// ── S6: erase fix ────────────────────────────────────────────────────────────
section('S6 — erase_household_data onboarding fix');
has(/set onboarding = '\{\}'::jsonb/i, "erase sets onboarding to '{}' not null");
// The EFFECTIVE definition is the LAST create-or-replace in the concat. The
// original 2026-07-01 migration (the buggy `= null`) is still in the file as
// history; what matters is that the LAST definition of the function is the fix.
{
  const defs = [...schema.matchAll(/create or replace function erase_household_data[\s\S]*?\$\$;/gi)];
  const last = defs.length ? defs[defs.length - 1][0] : '';
  ok(defs.length >= 2, 'erase_household_data is redefined (original + fix)');
  ok(/'\{\}'::jsonb/.test(last) && !/set onboarding = null/i.test(last),
    'the EFFECTIVE (last) erase definition uses \'{}\' and never null');
}

// ── F2: record_loan_payment + accounts.debt_id ───────────────────────────────
section('F2 — record_loan_payment + accounts.debt_id');
ok(fnExists('record_loan_payment'), 'record_loan_payment function created');
ok(tableExists('loan_payment_events'), 'loan_payment_events idempotency table');
has(/split_mismatch/i, 'record_loan_payment validates split reconciliation');
has(/on conflict \(operation_id\) do nothing/i, 'record_loan_payment idempotent on operation_id');
has(/'loan', v_debt.name, v_debt.currency, p_debt_id/i, 'loan account linked via debt_id (not asset_id)');

// ── S3: tenant consistency triggers ─────────────────────────────────────────
section('S3 — tenant-consistency triggers');
for (const f of ['assert_txn_tenant_consistency', 'assert_allocation_tenant_consistency', 'assert_split_tenant_consistency']) {
  ok(fnExists(f), `trigger fn: ${f}`);
}
for (const t of ['trg_txn_tenant_consistency', 'trg_allocation_tenant_consistency', 'trg_split_tenant_consistency']) {
  has(new RegExp(`create trigger ${t}`, 'i'), `trigger created: ${t}`);
}

// ── A2: atomic quota reservation ─────────────────────────────────────────────
section('A2 — reserve_ai_usage');
ok(fnExists('reserve_ai_usage'), 'reserve_ai_usage function created');
has(/for update/i, 'reserve_ai_usage row-locks (for update)');
has(/'reserved'/, "ai_usage outcome CHECK widened to include 'reserved'");
has(/42901/, 'reserve_ai_usage raises 42901 on quota');
has(/revoke all on function public\.reserve_ai_usage[\s\S]{0,120}?from public, anon, authenticated/i,
  'reserve_ai_usage not client-callable');

// ── A4: durable inbox ────────────────────────────────────────────────────────
section('A4 — durable inbox');
ok(columnExists('whatsapp_inbound_messages', 'attempts'), 'inbox.attempts exists');
ok(columnExists('whatsapp_inbound_messages', 'claimed_at'), 'inbox.claimed_at exists');
ok(columnExists('whatsapp_inbound_messages', 'last_error'), 'inbox.last_error exists');
has(/create index if not exists idx_wa_inbound_claim/i, 'inbox claim index');

// ── Migration naming / ordering sanity ──────────────────────────────────────
section('Migration files present on disk');
const migDir = path.join(root, 'supabase', 'migrations');
for (const f of [
  '20260908120000_audit_s1_whatsapp_identities.sql',
  '20260908120100_audit_s2_membership_role_grants.sql',
  '20260908120200_audit_s6_erase_onboarding_fix.sql',
  '20260908120300_audit_f2_record_loan_payment.sql',
  '20260909120000_audit_s3_tenant_consistency.sql',
  '20260909120100_audit_a2_atomic_ai_quota.sql',
  '20260909120200_audit_a4_durable_inbox.sql',
]) {
  ok(fs.existsSync(path.join(migDir, f)), `migration on disk: ${f}`);
}

console.log(`\n${'='.repeat(60)}`);
if (failures === 0) {
  console.log(`✓ ${checks} checks passed — new migrations are consistent with the schema.`);
  process.exit(0);
} else {
  console.error(`✗ ${failures} of ${checks} checks FAILED`);
  process.exit(1);
}
