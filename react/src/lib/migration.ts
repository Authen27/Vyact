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
