// FinFlow v4.1 — LocalStorage → Cloud migration
//
// Existing v6/v7 users have data in localStorage under the legacy keys
// (ff_transactions, ff_budgets, etc.). When they sign up, we offer to
// push that data into a new cloud household so they don't lose anything.

import type {
  Transaction, Budget, Goal, Member, Debt, Asset, ProfileTypeKey,
} from '../types';
import type { DataAdapter } from './dataAdapter';

export interface LocalSnapshot {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  members: Member[];
  debts: Debt[];
  assets: Asset[];
  hasData: boolean;
}

const KEY = (suffix: string) => `ff_${suffix}`;

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

export function readLocalSnapshot(): LocalSnapshot {
  const transactions = readJson<Transaction[]>(KEY('transactions'), []);
  const budgets      = readJson<Budget[]>     (KEY('budgets'),      []);
  const goals        = readJson<Goal[]>       (KEY('goals'),        []);
  const members      = readJson<Member[]>     (KEY('members'),      []);
  const debts        = readJson<Debt[]>       (KEY('debts'),        []);
  const assets       = readJson<Asset[]>      (KEY('assets'),       []);
  const hasData = transactions.length + budgets.length + goals.length +
                  members.length + debts.length + assets.length > 0;
  return { transactions, budgets, goals, members, debts, assets, hasData };
}

export interface MigrationResult {
  householdId: string;
  counts: { transactions: number; budgets: number; goals: number;
            members: number; debts: number; assets: number };
}

export async function migrateLocalToCloud(
  adapter: DataAdapter,
  householdName: string,
  householdType: ProfileTypeKey,
  baseCurrency: string,
): Promise<MigrationResult> {
  const snap = readLocalSnapshot();
  // 1. Create the household
  const household = await adapter.createHousehold(householdName, householdType, baseCurrency);
  // 2. Push every collection
  for (const m of snap.members)      await adapter.upsert('members',      household.id, { ...m, id: undefined });
  for (const t of snap.transactions) await adapter.upsert('transactions', household.id, { ...t, id: undefined });
  for (const b of snap.budgets)      await adapter.upsert('budgets',      household.id, { ...b, id: undefined });
  for (const g of snap.goals)        await adapter.upsert('goals',        household.id, { ...g, id: undefined });
  for (const d of snap.debts)        await adapter.upsert('debts',        household.id, { ...d, id: undefined });
  for (const a of snap.assets)       await adapter.upsert('assets',       household.id, { ...a, id: undefined });
  // 3. Activate
  await adapter.setActiveHousehold(household.id);
  // 4. Mark migrated so we don't prompt again
  localStorage.setItem('ff_migrated_at', new Date().toISOString());
  localStorage.setItem('ff_migrated_to', household.id);
  return {
    householdId: household.id,
    counts: {
      transactions: snap.transactions.length,
      budgets:      snap.budgets.length,
      goals:        snap.goals.length,
      members:      snap.members.length,
      debts:        snap.debts.length,
      assets:       snap.assets.length,
    },
  };
}

export function hasBeenMigrated(): boolean {
  return Boolean(localStorage.getItem('ff_migrated_at'));
}

// ────────────────────────────────────────────────────────────────
// v6.4 — Automatic anon → cloud migration on first sign-in.
//
// Triggered by the store after a successful sign-in if (a) the user has
// data in the anonymous (legacy `ff_*`) localStorage keys and (b) the
// active cloud household is empty (no transactions/budgets/goals/etc.).
// Idempotent via per-household local guard `ff_anon_migrated_<hid>`.
//
// NOTE: This is best-effort and same-device only. A server-side marker
// (households.extras.anon_migrated_at) is planned for a follow-up to
// prevent multi-device migration races.
// ────────────────────────────────────────────────────────────────

export interface AutoMigrationResult {
  ran: boolean;
  reason?: 'guard-set' | 'no-anon-data' | 'household-not-empty' | 'success';
  counts?: MigrationResult['counts'];
}

const guardKey = (hid: string) => `ff_anon_migrated_${hid}`;

export async function autoMigrateAnonToHousehold(
  adapter: DataAdapter,
  householdId: string,
): Promise<AutoMigrationResult> {
  if (!householdId || householdId === 'local') {
    return { ran: false, reason: 'guard-set' };
  }
  if (typeof localStorage !== 'undefined' && localStorage.getItem(guardKey(householdId))) {
    return { ran: false, reason: 'guard-set' };
  }
  const snap = readLocalSnapshot();
  if (!snap.hasData) {
    try { localStorage.setItem(guardKey(householdId), '1'); } catch { /* noop */ }
    return { ran: false, reason: 'no-anon-data' };
  }
  // Confirm the cloud household is genuinely empty before we duplicate
  // data into it. Probes use the adapter so HybridAdapter's cache + cloud
  // logic both apply.
  const [txs, bs, gs, ms, ds, as_] = await Promise.all([
    adapter.list<Transaction>('transactions', householdId),
    adapter.list<Budget>     ('budgets',      householdId),
    adapter.list<Goal>       ('goals',        householdId),
    adapter.list<Member>     ('members',      householdId),
    adapter.list<Debt>       ('debts',        householdId),
    adapter.list<Asset>      ('assets',       householdId),
  ]);
  const cloudHasData = txs.length + bs.length + gs.length + ms.length + ds.length + as_.length > 0;
  if (cloudHasData) {
    try { localStorage.setItem(guardKey(householdId), '1'); } catch { /* noop */ }
    return { ran: false, reason: 'household-not-empty' };
  }
  // Copy. We strip ids so the adapter mints fresh ones (avoids cross-tenant
  // collisions and ensures the cloud is the source of truth for primary keys).
  for (const m of snap.members)      await adapter.upsert('members',      householdId, { ...m, id: undefined });
  for (const t of snap.transactions) await adapter.upsert('transactions', householdId, { ...t, id: undefined });
  for (const b of snap.budgets)      await adapter.upsert('budgets',      householdId, { ...b, id: undefined });
  for (const g of snap.goals)        await adapter.upsert('goals',        householdId, { ...g, id: undefined });
  for (const d of snap.debts)        await adapter.upsert('debts',        householdId, { ...d, id: undefined });
  for (const a of snap.assets)       await adapter.upsert('assets',       householdId, { ...a, id: undefined });
  try { localStorage.setItem(guardKey(householdId), '1'); } catch { /* noop */ }
  return {
    ran: true,
    reason: 'success',
    counts: {
      transactions: snap.transactions.length,
      budgets:      snap.budgets.length,
      goals:        snap.goals.length,
      members:      snap.members.length,
      debts:        snap.debts.length,
      assets:       snap.assets.length,
    },
  };
}
