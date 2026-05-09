// FinFlow v6 — TypeScript DataAdapter
// LocalStorageAdapter is the active impl; SupabaseAdapter is reserved
// for the cloud phase. The interface lets us swap with one line in main.tsx.
//
// Backward-compat: anonymous-mode uses the legacy v4/v5 storage keys
// (`ff_transactions`, `ff_budgets`, …) so existing data survives.

import type {
  Transaction, Budget, Goal, Member, Debt, Asset,
  Profile, ExchangeRates, HouseholdMeta, ProfileTypeKey,
} from '../types';
import { DEFAULT_RATES } from '../constants';
import { uid } from './format';

export type Entity = 'transactions' | 'budgets' | 'goals' | 'debts' | 'assets' | 'members';

export interface DataAdapter {
  // households / profiles
  listHouseholds(): Promise<HouseholdMeta[]>;
  createHousehold(name: string, type: ProfileTypeKey, baseCurrency?: string): Promise<HouseholdMeta>;
  updateHousehold(id: string, patch: Partial<HouseholdMeta>): Promise<HouseholdMeta>;
  deleteHousehold(id: string): Promise<void>;
  getActiveHousehold(): Promise<string>;
  setActiveHousehold(id: string): Promise<string>;

  // profile (per-household)
  getProfile(householdId: string): Promise<Profile | null>;
  updateProfile(householdId: string, patch: Partial<Profile>): Promise<Profile>;

  // generic domain CRUD
  list<T = unknown>(entity: Entity, householdId: string): Promise<T[]>;
  upsert<T extends { id?: string } = { id?: string }>(entity: Entity, householdId: string, record: T): Promise<T & { id: string }>;
  remove(entity: Entity, householdId: string, id: string): Promise<void>;
  replaceAll<T = unknown>(entity: Entity, householdId: string, records: T[]): Promise<T[]>;

  // exchange rates (per-household)
  getRates(householdId: string): Promise<ExchangeRates>;
  upsertRate(householdId: string, code: string, rate: number): Promise<void>;
}

const ANON = 'local';

export class LocalStorageAdapter implements DataAdapter {
  private key(suffix: string, householdId: string): string {
    return householdId === ANON ? `ff_${suffix}` : `ff_${householdId}_${suffix}`;
  }
  private read<T>(suffix: string, householdId: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(this.key(suffix, householdId)) ?? 'null') ?? fallback; }
    catch { return fallback; }
  }
  private write<T>(suffix: string, householdId: string, value: T): void {
    localStorage.setItem(this.key(suffix, householdId), JSON.stringify(value));
  }

  // ── households ────────────────────────────────────────────────
  async listHouseholds(): Promise<HouseholdMeta[]> {
    const list = JSON.parse(localStorage.getItem('ff_profiles_list') || 'null') as HouseholdMeta[] | null;
    if (!list) {
      const def: HouseholdMeta[] = [{
        id: ANON, name: 'My Household', type: 'family',
        baseCurrency: 'USD', createdAt: new Date().toISOString(),
      }];
      localStorage.setItem('ff_profiles_list', JSON.stringify(def));
      return def;
    }
    return list;
  }
  async createHousehold(name: string, type: ProfileTypeKey = 'personal', baseCurrency = 'USD'): Promise<HouseholdMeta> {
    const list = await this.listHouseholds();
    const meta: HouseholdMeta = {
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, type, baseCurrency, createdAt: new Date().toISOString(),
    };
    list.push(meta);
    localStorage.setItem('ff_profiles_list', JSON.stringify(list));
    return meta;
  }
  async updateHousehold(id: string, patch: Partial<HouseholdMeta>): Promise<HouseholdMeta> {
    const list = await this.listHouseholds();
    const idx = list.findIndex(h => h.id === id);
    if (idx < 0) throw new Error('Household not found');
    list[idx] = { ...list[idx], ...patch };
    localStorage.setItem('ff_profiles_list', JSON.stringify(list));
    return list[idx];
  }
  async deleteHousehold(id: string): Promise<void> {
    if (id === ANON) throw new Error('Cannot delete the default profile');
    ['transactions','budgets','goals','members','debts','assets','rates','profile'].forEach(e =>
      localStorage.removeItem(this.key(e, id))
    );
    const list = (await this.listHouseholds()).filter(h => h.id !== id);
    localStorage.setItem('ff_profiles_list', JSON.stringify(list));
  }
  async getActiveHousehold(): Promise<string> {
    return localStorage.getItem('ff_active_profile') || ANON;
  }
  async setActiveHousehold(id: string): Promise<string> {
    localStorage.setItem('ff_active_profile', id);
    return id;
  }

  // ── profile ──────────────────────────────────────────────────
  async getProfile(householdId: string): Promise<Profile | null> {
    return this.read<Profile | null>('profile', householdId, null);
  }
  async updateProfile(householdId: string, patch: Partial<Profile>): Promise<Profile> {
    const cur = (await this.getProfile(householdId)) ?? {
      name: '', email: '', baseCurrency: 'USD', language: 'en',
      household: 'family', dateFormat: 'us', payoffStrategy: 'avalanche', extraPayment: 0,
    };
    const next = { ...cur, ...patch };
    this.write('profile', householdId, next);
    return next;
  }

  // ── generic CRUD ─────────────────────────────────────────────
  async list<T = unknown>(entity: Entity, householdId: string): Promise<T[]> {
    return this.read<T[]>(entity, householdId, []);
  }
  async upsert<T extends { id?: string } = { id?: string }>(entity: Entity, householdId: string, record: T): Promise<T & { id: string }> {
    const list = this.read<(T & { id: string })[]>(entity, householdId, []);
    const id = record.id || uid();
    const next = { ...record, id, updated_at: new Date().toISOString() } as T & { id: string };
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) list[idx] = next; else list.push(next);
    this.write(entity, householdId, list);
    return next;
  }
  async remove(entity: Entity, householdId: string, id: string): Promise<void> {
    const list = this.read<{ id: string }[]>(entity, householdId, []);
    this.write(entity, householdId, list.filter(r => r.id !== id));
  }
  async replaceAll<T = unknown>(entity: Entity, householdId: string, records: T[]): Promise<T[]> {
    this.write(entity, householdId, records);
    return records;
  }

  // ── rates ────────────────────────────────────────────────────
  async getRates(householdId: string): Promise<ExchangeRates> {
    return { ...DEFAULT_RATES, ...this.read<ExchangeRates>('rates', householdId, {}) };
  }
  async upsertRate(householdId: string, code: string, rate: number): Promise<void> {
    const rates = this.read<ExchangeRates>('rates', householdId, {});
    rates[code] = rate;
    this.write('rates', householdId, rates);
  }
}

// Convenience typed listers (for store)
export interface TypedListers {
  listTransactions(adapter: DataAdapter, h: string): Promise<Transaction[]>;
  listBudgets(adapter: DataAdapter, h: string): Promise<Budget[]>;
  listGoals(adapter: DataAdapter, h: string): Promise<Goal[]>;
  listMembers(adapter: DataAdapter, h: string): Promise<Member[]>;
  listDebts(adapter: DataAdapter, h: string): Promise<Debt[]>;
  listAssets(adapter: DataAdapter, h: string): Promise<Asset[]>;
}

export const typed: TypedListers = {
  listTransactions: (a, h) => a.list<Transaction>('transactions', h),
  listBudgets:      (a, h) => a.list<Budget>('budgets', h),
  listGoals:        (a, h) => a.list<Goal>('goals', h),
  listMembers:      (a, h) => a.list<Member>('members', h),
  listDebts:        (a, h) => a.list<Debt>('debts', h),
  listAssets:       (a, h) => a.list<Asset>('assets', h),
};
