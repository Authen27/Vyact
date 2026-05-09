// FinFlow v4.1 — Real SupabaseAdapter
// Implements the DataAdapter interface against the Postgres schema in db/schema.sql.
// All authorization is enforced server-side by RLS policies — clients can't bypass.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Transaction, Budget, Goal, Member, Debt, Asset,
  Profile, ExchangeRates, HouseholdMeta, ProfileTypeKey,
} from '../types';
import type { DataAdapter, Entity } from './dataAdapter';

// Map between our camelCase JS shapes and snake_case Postgres columns.
// Most columns are 1:1; the exceptions are listed here per entity.
type RowOf<E extends Entity> =
  E extends 'transactions' ? TransactionRow :
  E extends 'budgets'      ? BudgetRow :
  E extends 'goals'        ? GoalRow :
  E extends 'debts'        ? DebtRow :
  E extends 'assets'       ? AssetRow :
  E extends 'members'      ? MembershipRow :
  never;

interface TransactionRow {
  id: string; household_id: string; created_by: string | null; member_id: string | null;
  type: string; amount: number; currency: string; date: string;
  description: string; category: string; note: string | null;
  recurring: string | null; attachment_url: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
  // v5+ extensions stored as JSON on the row (until columns are added)
  extras?: { paymentMethod?: string; excluded?: boolean; linkedAssetId?: string;
             linkedDebtId?: string; linkedTxnId?: string; split?: unknown } | null;
}

interface BudgetRow {
  id: string; household_id: string;
  category: string; monthly_limit: number; currency: string; color: string | null;
  updated_at: string; deleted_at: string | null;
}

interface GoalRow {
  id: string; household_id: string;
  type: string; name: string;
  target_amount: number; current_amount: number; currency: string;
  deadline: string | null; completed: boolean;
  updated_at: string; deleted_at: string | null;
}

interface DebtRow {
  id: string; household_id: string;
  type: string; name: string; lender: string | null; account_last4: string | null;
  principal: number | null; current_balance: number; interest_rate: number;
  minimum_payment: number; due_date: string | null; currency: string;
  updated_at: string; deleted_at: string | null;
  extras?: { tenureMonths?: number; remainingMonths?: number; paymentLog?: unknown } | null;
}

interface AssetRow {
  id: string; household_id: string;
  type: string; name: string; value: number; currency: string;
  liquidity: string; note: string | null; last_updated: string | null;
  updated_at: string; deleted_at: string | null;
}

interface MembershipRow {
  id: string; household_id: string; user_id: string | null;
  role: string; display_name: string; household_role: string | null;
  joined_at: string;
}

// ── Mappers ───────────────────────────────────────────────────
const txnToRow = (t: Partial<Transaction>, householdId: string): Partial<TransactionRow> => ({
  id: t.id, household_id: householdId, member_id: t.memberId || null,
  type: t.type, amount: t.amount, currency: t.currency || 'USD',
  date: t.date, description: t.description, category: t.category,
  note: t.note || null,
  recurring: t.recurring || null,
  extras: {
    paymentMethod: t.paymentMethod, excluded: t.excluded,
    linkedAssetId: t.linkedAssetId, linkedDebtId: t.linkedDebtId,
    linkedTxnId: t.linkedTxnId, split: t.split,
  },
});
const rowToTxn = (r: TransactionRow): Transaction => ({
  id: r.id, type: r.type as Transaction['type'],
  amount: Number(r.amount), currency: r.currency,
  date: r.date, description: r.description, category: r.category,
  note: r.note || undefined,
  memberId: r.member_id || undefined,
  recurring: (r.recurring as Transaction['recurring']) || undefined,
  paymentMethod: r.extras?.paymentMethod,
  excluded: r.extras?.excluded,
  linkedAssetId: r.extras?.linkedAssetId,
  linkedDebtId: r.extras?.linkedDebtId,
  linkedTxnId: r.extras?.linkedTxnId,
  split: r.extras?.split as Transaction['split'],
  created_by: r.created_by || undefined,
  created_at: r.created_at, updated_at: r.updated_at,
});

const budgetToRow = (b: Partial<Budget>, hid: string): Partial<BudgetRow> => ({
  id: b.id, household_id: hid, category: b.category!,
  monthly_limit: b.limit!, currency: b.currency || 'USD', color: b.color || null,
});
const rowToBudget = (r: BudgetRow): Budget => ({
  id: r.id, category: r.category, limit: Number(r.monthly_limit),
  currency: r.currency, color: r.color || undefined,
});

const goalToRow = (g: Partial<Goal>, hid: string): Partial<GoalRow> => ({
  id: g.id, household_id: hid, type: g.type!, name: g.name!,
  target_amount: g.target!, current_amount: g.current ?? 0,
  currency: g.currency || 'USD', deadline: g.deadline || null,
  completed: g.completed ?? false,
});
const rowToGoal = (r: GoalRow): Goal => ({
  id: r.id, type: r.type as Goal['type'], name: r.name,
  target: Number(r.target_amount), current: Number(r.current_amount),
  currency: r.currency, deadline: r.deadline || undefined,
  completed: r.completed,
});

const debtToRow = (d: Partial<Debt>, hid: string): Partial<DebtRow> => ({
  id: d.id, household_id: hid, type: d.type!, name: d.name!,
  lender: d.lender || null,
  account_last4: d.account ? d.account.slice(-4) : null,
  principal: d.principal ?? null,
  current_balance: d.currentBalance!,
  interest_rate: d.interestRate!,
  minimum_payment: d.minimumPayment!,
  due_date: d.dueDate || null,
  currency: d.currency || 'USD',
  extras: {
    tenureMonths: d.tenureMonths,
    remainingMonths: d.remainingMonths,
    paymentLog: d.paymentLog,
  },
});
const rowToDebt = (r: DebtRow): Debt => ({
  id: r.id, type: r.type, name: r.name,
  lender: r.lender || undefined,
  account: r.account_last4 || undefined,
  principal: r.principal ? Number(r.principal) : 0,
  currentBalance: Number(r.current_balance),
  interestRate: Number(r.interest_rate),
  minimumPayment: Number(r.minimum_payment),
  dueDate: r.due_date || undefined,
  currency: r.currency,
  tenureMonths: r.extras?.tenureMonths,
  remainingMonths: r.extras?.remainingMonths,
  paymentLog: r.extras?.paymentLog as Debt['paymentLog'],
});

const assetToRow = (a: Partial<Asset>, hid: string): Partial<AssetRow> => ({
  id: a.id, household_id: hid, type: a.type!, name: a.name!,
  value: a.value!, currency: a.currency || 'USD',
  liquidity: a.liquidity!, note: a.note || null,
  last_updated: a.lastUpdated || null,
});
const rowToAsset = (r: AssetRow): Asset => ({
  id: r.id, type: r.type, name: r.name,
  value: Number(r.value), currency: r.currency,
  liquidity: r.liquidity as Asset['liquidity'],
  note: r.note || undefined,
  lastUpdated: r.last_updated || undefined,
});

const memberToRow = (m: Partial<Member>, hid: string): Partial<MembershipRow> => ({
  id: m.id, household_id: hid,
  display_name: m.name!,
  household_role: m.role || 'primary',
  role: m.appRole || 'member',
});
const rowToMember = (r: MembershipRow): Member => ({
  id: r.id, name: r.display_name,
  role: (r.household_role || 'primary') as Member['role'],
  appRole: r.role as Member['appRole'],
});

// ── Adapter ───────────────────────────────────────────────────
export class SupabaseAdapter implements DataAdapter {
  constructor(private sb: SupabaseClient) {}

  // ── households ─────────────────────────────────────────────
  async listHouseholds(): Promise<HouseholdMeta[]> {
    const { data, error } = await this.sb
      .from('my_households')
      .select('id,name,type,base_currency,created_at')
      .order('created_at');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id, name: r.name, type: r.type as ProfileTypeKey,
      baseCurrency: r.base_currency, createdAt: r.created_at,
    }));
  }

  async createHousehold(name: string, type: ProfileTypeKey, baseCurrency = 'USD'): Promise<HouseholdMeta> {
    const { data: { user } } = await this.sb.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { data, error } = await this.sb.from('households')
      .insert({ name, type, base_currency: baseCurrency, created_by: user.id })
      .select('id,name,type,base_currency,created_at').single();
    if (error) throw error;
    return { id: data.id, name: data.name, type: data.type as ProfileTypeKey,
             baseCurrency: data.base_currency, createdAt: data.created_at };
  }

  async updateHousehold(id: string, patch: Partial<HouseholdMeta>): Promise<HouseholdMeta> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.baseCurrency !== undefined) update.base_currency = patch.baseCurrency;
    const { data, error } = await this.sb.from('households').update(update).eq('id', id)
      .select('id,name,type,base_currency,created_at').single();
    if (error) throw error;
    return { id: data.id, name: data.name, type: data.type as ProfileTypeKey,
             baseCurrency: data.base_currency, createdAt: data.created_at };
  }

  async deleteHousehold(id: string): Promise<void> {
    const { error } = await this.sb.from('households').delete().eq('id', id);
    if (error) throw error;
  }

  async getActiveHousehold(): Promise<string> {
    return localStorage.getItem('ff_active_profile') || (await this.listHouseholds())[0]?.id || '';
  }
  async setActiveHousehold(id: string): Promise<string> {
    localStorage.setItem('ff_active_profile', id);
    return id;
  }

  // ── profile ────────────────────────────────────────────────
  // Profile is per-user (not per-household) in cloud — stored in `profiles` table.
  // We keep the per-household profile signature for adapter compatibility, but
  // most fields come from the user-level profile and are merged with the
  // household's base_currency.
  async getProfile(householdId: string): Promise<Profile | null> {
    const { data: { user } } = await this.sb.auth.getUser();
    if (!user) return null;
    const { data: prof } = await this.sb.from('profiles')
      .select('display_name,default_currency,language,date_format')
      .eq('id', user.id).single();
    const { data: hh } = await this.sb.from('households')
      .select('name,type,base_currency,language,payoff_strategy,extra_payment')
      .eq('id', householdId).single();
    if (!prof || !hh) return null;
    return {
      name: prof.display_name || '',
      email: user.email || '',
      baseCurrency: hh.base_currency || prof.default_currency || 'USD',
      language: hh.language || prof.language || 'en',
      household: (hh.type || 'family') as ProfileTypeKey,
      dateFormat: (prof.date_format as Profile['dateFormat']) || 'us',
      payoffStrategy: (hh.payoff_strategy as Profile['payoffStrategy']) || 'avalanche',
      extraPayment: Number(hh.extra_payment) || 0,
    };
  }
  async updateProfile(householdId: string, patch: Partial<Profile>): Promise<Profile> {
    const { data: { user } } = await this.sb.auth.getUser();
    if (!user) throw new Error('Not signed in');
    // User-level fields → profiles
    const userPatch: Record<string, unknown> = {};
    if (patch.name        !== undefined) userPatch.display_name = patch.name;
    if (patch.dateFormat  !== undefined) userPatch.date_format = patch.dateFormat;
    if (patch.language    !== undefined) userPatch.language = patch.language;
    if (Object.keys(userPatch).length) {
      await this.sb.from('profiles').update(userPatch).eq('id', user.id);
    }
    // Household-level fields → households
    const hhPatch: Record<string, unknown> = {};
    if (patch.baseCurrency   !== undefined) hhPatch.base_currency = patch.baseCurrency;
    if (patch.household      !== undefined) hhPatch.type = patch.household;
    if (patch.language       !== undefined) hhPatch.language = patch.language;
    if (patch.payoffStrategy !== undefined) hhPatch.payoff_strategy = patch.payoffStrategy;
    if (patch.extraPayment   !== undefined) hhPatch.extra_payment = patch.extraPayment;
    if (Object.keys(hhPatch).length) {
      await this.sb.from('households').update(hhPatch).eq('id', householdId);
    }
    return (await this.getProfile(householdId))!;
  }

  // ── domain CRUD ────────────────────────────────────────────
  async list<T = unknown>(entity: Entity, householdId: string): Promise<T[]> {
    if (entity === 'members') {
      const { data, error } = await this.sb.from('memberships')
        .select('*').eq('household_id', householdId).order('joined_at');
      if (error) throw error;
      return (data || []).map(rowToMember) as unknown as T[];
    }
    const { data, error } = await this.sb.from(entity)
      .select('*').eq('household_id', householdId).is('deleted_at', null);
    if (error) throw error;
    const rows = data || [];
    if (entity === 'transactions') return rows.map(rowToTxn) as unknown as T[];
    if (entity === 'budgets')      return rows.map(rowToBudget) as unknown as T[];
    if (entity === 'goals')        return rows.map(rowToGoal) as unknown as T[];
    if (entity === 'debts')        return rows.map(rowToDebt) as unknown as T[];
    if (entity === 'assets')       return rows.map(rowToAsset) as unknown as T[];
    return [];
  }

  async upsert<T extends { id?: string } = { id?: string }>(entity: Entity, householdId: string, record: T): Promise<T & { id: string }> {
    let row: Record<string, unknown>;
    if      (entity === 'transactions') row = txnToRow   (record as Partial<Transaction>, householdId);
    else if (entity === 'budgets')      row = budgetToRow(record as Partial<Budget>,      householdId);
    else if (entity === 'goals')        row = goalToRow  (record as Partial<Goal>,        householdId);
    else if (entity === 'debts')        row = debtToRow  (record as Partial<Debt>,        householdId);
    else if (entity === 'assets')       row = assetToRow (record as Partial<Asset>,       householdId);
    else if (entity === 'members')      row = memberToRow(record as Partial<Member>,      householdId);
    else throw new Error(`Unknown entity: ${entity}`);

    const tableName = entity === 'members' ? 'memberships' : entity;
    // If id present → update; else → insert
    if (row.id) {
      const id = row.id as string;
      delete row.id;
      const { data, error } = await this.sb.from(tableName).update(row).eq('id', id).select().single();
      if (error) throw error;
      return this.mapRowBack(entity, data) as T & { id: string };
    } else {
      delete row.id;
      const { data, error } = await this.sb.from(tableName).insert(row).select().single();
      if (error) throw error;
      return this.mapRowBack(entity, data) as T & { id: string };
    }
  }

  async remove(entity: Entity, householdId: string, id: string): Promise<void> {
    const tableName = entity === 'members' ? 'memberships' : entity;
    if (entity === 'members') {
      const { error } = await this.sb.from('memberships').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    // Soft-delete for syncable tables
    const { error } = await this.sb.from(tableName)
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    void householdId;
  }

  async replaceAll<T = unknown>(entity: Entity, householdId: string, records: T[]): Promise<T[]> {
    // Used during bulk imports. Soft-delete existing then insert.
    const tableName = entity === 'members' ? 'memberships' : entity;
    if (entity !== 'members') {
      await this.sb.from(tableName).update({ deleted_at: new Date().toISOString() })
        .eq('household_id', householdId).is('deleted_at', null);
    } else {
      await this.sb.from('memberships').delete().eq('household_id', householdId);
    }
    for (const r of records) await this.upsert(entity, householdId, r as { id?: string });
    return records;
  }

  // ── rates ──────────────────────────────────────────────────
  async getRates(householdId: string): Promise<ExchangeRates> {
    const { data, error } = await this.sb.from('exchange_rates')
      .select('currency_code,rate_to_usd').eq('household_id', householdId);
    if (error) throw error;
    return Object.fromEntries((data || []).map(r => [r.currency_code, Number(r.rate_to_usd)]));
  }
  async upsertRate(householdId: string, code: string, rate: number): Promise<void> {
    const { error } = await this.sb.from('exchange_rates').upsert({
      household_id: householdId, currency_code: code, rate_to_usd: rate,
    });
    if (error) throw error;
  }

  // Private helper — convert a returned row back to its JS shape
  private mapRowBack(entity: Entity, row: unknown): unknown {
    if (entity === 'transactions') return rowToTxn   (row as TransactionRow);
    if (entity === 'budgets')      return rowToBudget(row as BudgetRow);
    if (entity === 'goals')        return rowToGoal  (row as GoalRow);
    if (entity === 'debts')        return rowToDebt  (row as DebtRow);
    if (entity === 'assets')       return rowToAsset (row as AssetRow);
    if (entity === 'members')      return rowToMember(row as MembershipRow);
    return row;
  }

  // ── auth-adjacent helpers (used by store) ──────────────────
  // Note: actual auth methods (signIn/signUp) live in lib/auth.ts to keep
  // the adapter focused on data CRUD. Subscriptions for realtime are also
  // separate — see lib/realtime.ts.
}
