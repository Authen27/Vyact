// Vyact v4.1 — Real SupabaseAdapter
// Implements the DataAdapter interface against the Postgres schema in db/schema.sql.
// All authorization is enforced server-side by RLS policies — clients can't bypass.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Transaction, Budget, Goal, Member, Debt, Asset, Account, SavedView,
  Profile, ExchangeRates, HouseholdMeta, ProfileTypeKey,
  WithProvenance, Confidence, ProvenanceSource,
} from '../types';
import type { DataAdapter, Entity } from './dataAdapter';
import { parseMoneyFromCloud } from './money';

// TD-01 phase D: money fields arriving from Supabase (`numeric(15,2)`
// columns serialised as JSON strings) go through `parseMoneyFromCloud`
// in every row mapper below — centralising the boundary instead of
// scattering `Number(r.x)` casts so a future PR can replace `number`
// with a `Money` opaque type in one place. Non-money decimals
// (interest_rate %, rate_to_usd) keep their plain `Number()` cast on
// purpose; their semantics (rate, not money) call for a different
// failure mode (raise rather than coerce to 0).

// Map between our camelCase JS shapes and snake_case Postgres columns.
// Most columns are 1:1; the exceptions are listed here per entity.
type RowOf<E extends Entity> =
  E extends 'transactions' ? TransactionRow :
  E extends 'budgets'      ? BudgetRow :
  E extends 'goals'        ? GoalRow :
  E extends 'debts'        ? DebtRow :
  E extends 'assets'       ? AssetRow :
  E extends 'accounts'     ? AccountRow :
  E extends 'savedViews'   ? SavedViewRow :
  E extends 'members'      ? MembershipRow :
  never;

interface TransactionRow {
  id: string; household_id: string; created_by: string | null; member_id: string | null;
  type: string; amount: number; currency: string; date: string;
  description: string; category: string; note: string | null;
  recurring: string | null; attachment_url: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
  // v7.1 Money Map — real FK columns. Optional in the typing because the
  // production rows still come back without them set on legacy data.
  account_id?: string | null;
  to_account_id?: string | null;
  initiated_by?: string | null;
  // v8 — provenance columns (see ProvenanceRowCols / 20260606120000 migration).
  confidence?: string | null;
  source?: string | null;
  estimated_at?: string | null;
  confirmed_at?: string | null;
  // v5+ extensions stored as JSON on the row (until columns are added)
  extras?: { time?: string; paymentMethod?: string; excluded?: boolean; linkedAssetId?: string;
             linkedToAssetId?: string;
             linkedDebtId?: string; linkedTxnId?: string; split?: unknown;
             accountSplits?: unknown } | null;
}

// v8 — provenance columns shared by baseline-derived rows.
interface ProvenanceRowCols {
  confidence?: string | null;
  source?: string | null;
  estimated_at?: string | null;
  confirmed_at?: string | null;
}

interface BudgetRow extends ProvenanceRowCols {
  id: string; household_id: string;
  category: string; monthly_limit: number; currency: string; color: string | null;
  period?: string | null; period_start?: string | null; period_end?: string | null;
  allocations?: { category: string; limit: number }[] | null;   // Money-Model B2.3
  updated_at: string; deleted_at: string | null;
}

interface GoalRow extends ProvenanceRowCols {
  id: string; household_id: string;
  type: string; name: string;
  target_amount: number; current_amount: number; currency: string;
  deadline: string | null; completed: boolean;
  updated_at: string; deleted_at: string | null;
}

interface DebtRow extends ProvenanceRowCols {
  id: string; household_id: string;
  type: string; name: string; lender: string | null; account_last4: string | null;
  principal: number | null; current_balance: number; interest_rate: number;
  minimum_payment: number; due_date: string | null; currency: string;
  updated_at: string; deleted_at: string | null;
  // v7.1 Money Map — bidirectional debt support.
  direction?: string | null;
  counterparty_name?: string | null;
  extras?: { tenureMonths?: number; remainingMonths?: number; paymentLog?: unknown } | null;
}

interface AssetRow extends ProvenanceRowCols {
  id: string; household_id: string;
  type: string; name: string; value: number; currency: string;
  liquidity: string; note: string | null; last_updated: string | null;
  updated_at: string; deleted_at: string | null;
}

// v7.1 Money Map — first-class accounts table.
interface AccountRow extends ProvenanceRowCols {
  id: string; household_id: string;
  asset_id: string | null;
  kind: string; name: string; currency: string;
  is_default: boolean; is_archived: boolean;
  opening_balance?: number | null;   // Money-Model B1.2
  created_at: string; updated_at: string; deleted_at: string | null;
}

// v7.3 Money Map — saved filter views (Item #4). Per-user, per-page.
interface SavedViewRow {
  id: string; user_id: string; household_id: string;
  page: string; name: string;
  filters: Record<string, unknown> | null;
  is_shared: boolean;
  created_at: string; updated_at: string; deleted_at: string | null;
}

interface MembershipRow {
  id: string; household_id: string; user_id: string | null;
  role: string; display_name: string; household_role: string | null;
  joined_at: string;
}

// ── v8 provenance columns (shared across baseline-derived entities) ──────────
// confidence/source/estimated_at/confirmed_at columns added by
// 20260606120000_v8_onboarding_state.sql. DB default is 'confirmed' / 'user', so
// undefined here lets the column default own legacy + ordinary rows.
const provToRow = (p: WithProvenance): ProvenanceRowCols => ({
  confidence: p.confidence ?? undefined,
  source: p.source ?? undefined,
  estimated_at: p.estimatedAt ?? undefined,
  confirmed_at: p.confirmedAt ?? undefined,
});
const rowToProv = (r: ProvenanceRowCols): WithProvenance => ({
  confidence: (r.confidence as Confidence) || undefined,
  source: (r.source as ProvenanceSource) || undefined,
  estimatedAt: r.estimated_at || undefined,
  confirmedAt: r.confirmed_at || undefined,
});

// ── Mappers ───────────────────────────────────────────────────
const txnToRow = (t: Partial<Transaction>, householdId: string): Partial<TransactionRow> => ({
  ...provToRow(t),
  id: t.id, household_id: householdId, member_id: t.memberId || null,
  type: t.type, amount: t.amount, currency: t.currency || 'USD',
  date: t.date, description: t.description, category: t.category,
  note: t.note || null,
  recurring: t.recurring || null,
  // v7.1 Money Map dual-write: populate FK columns from accountId/toAccountId
  // if set, else fall back to legacy linkedAssetId (assets and accounts share
  // asset_id after the v7.1 backfill). Legacy keys stay in extras so a v7.0.3
  // client reading the same row still works (dual-encoding contract).
  account_id:    t.accountId    ?? t.linkedAssetId   ?? null,
  to_account_id: t.toAccountId  ?? t.linkedToAssetId ?? null,
  initiated_by:  t.initiatedBy  ?? t.memberId        ?? null,
  extras: {
    time: t.time, paymentMethod: t.paymentMethod, excluded: t.excluded,
    linkedAssetId: t.linkedAssetId, linkedToAssetId: t.linkedToAssetId,
    linkedDebtId: t.linkedDebtId,
    linkedTxnId: t.linkedTxnId, split: t.split,
    // v7.3 — Money Map Item #5 (multi-account split). Stored on extras
    // until a dedicated table lands in v7.4.
    accountSplits: t.accountSplits,
  },
});
const rowToTxn = (r: TransactionRow): Transaction => ({
  id: r.id, type: r.type as Transaction['type'],
  amount: parseMoneyFromCloud(r.amount), currency: r.currency,
  date: r.date, time: r.extras?.time, description: r.description, category: r.category,
  note: r.note || undefined,
  memberId: r.member_id || undefined,
  recurring: (r.recurring as Transaction['recurring']) || undefined,
  paymentMethod: r.extras?.paymentMethod,
  excluded: r.extras?.excluded,
  // v7.1 — prefer FK columns; fall back to legacy extras for rows written
  // by a v7.0.3 client during the dual-write window.
  accountId:   r.account_id    ?? r.extras?.linkedAssetId   ?? undefined,
  toAccountId: r.to_account_id ?? r.extras?.linkedToAssetId ?? undefined,
  initiatedBy: r.initiated_by  ?? r.member_id               ?? undefined,
  linkedAssetId: r.extras?.linkedAssetId,
  linkedToAssetId: r.extras?.linkedToAssetId,
  linkedDebtId: r.extras?.linkedDebtId,
  linkedTxnId: r.extras?.linkedTxnId,
  split: r.extras?.split as Transaction['split'],
  accountSplits: r.extras?.accountSplits as Transaction['accountSplits'],
  created_by: r.created_by || undefined,
  created_at: r.created_at, updated_at: r.updated_at,
  ...rowToProv(r),
});

const budgetToRow = (b: Partial<Budget>, hid: string): Partial<BudgetRow> => ({
  ...provToRow(b),
  id: b.id, household_id: hid, category: b.category!,
  monthly_limit: b.limit!, currency: b.currency || 'USD', color: b.color || null,
  period: b.period || null, period_start: b.periodStart || null, period_end: b.periodEnd || null,
  allocations: b.allocations ?? [],   // Money-Model B2.3
});
const rowToBudget = (r: BudgetRow): Budget => ({
  id: r.id, category: r.category, limit: parseMoneyFromCloud(r.monthly_limit),
  currency: r.currency, color: r.color || undefined,
  period: (r.period as Budget['period']) || 'monthly',
  periodStart: r.period_start || undefined,
  periodEnd: r.period_end || undefined,
  allocations: Array.isArray(r.allocations) && r.allocations.length
    ? r.allocations.map(a => ({ category: a.category, limit: parseMoneyFromCloud(a.limit) }))
    : undefined,
  updated_at: r.updated_at,   // TD-03 phase B — concurrency precondition
  ...rowToProv(r),
});

const goalToRow = (g: Partial<Goal>, hid: string): Partial<GoalRow> => ({
  ...provToRow(g),
  id: g.id, household_id: hid, type: g.type!, name: g.name!,
  target_amount: g.target!, current_amount: g.current ?? 0,
  currency: g.currency || 'USD', deadline: g.deadline || null,
  completed: g.completed ?? false,
});
const rowToGoal = (r: GoalRow): Goal => ({
  id: r.id, type: r.type as Goal['type'], name: r.name,
  target: parseMoneyFromCloud(r.target_amount), current: parseMoneyFromCloud(r.current_amount),
  currency: r.currency, deadline: r.deadline || undefined,
  completed: r.completed,
  updated_at: r.updated_at,   // TD-03 phase B — concurrency precondition
  ...rowToProv(r),
});

const debtToRow = (d: Partial<Debt>, hid: string): Partial<DebtRow> => ({
  ...provToRow(d),
  id: d.id, household_id: hid, type: d.type!, name: d.name!,
  lender: d.lender || null,
  account_last4: d.account ? d.account.slice(-4) : null,
  principal: d.principal ?? null,
  current_balance: d.currentBalance!,
  interest_rate: d.interestRate!,
  minimum_payment: d.minimumPayment!,
  due_date: d.dueDate || null,
  currency: d.currency || 'USD',
  // v7.1 Money Map — lending. Default keeps legacy semantics.
  direction: d.direction || 'owed_by_me',
  counterparty_name: d.counterpartyName || null,
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
  principal: parseMoneyFromCloud(r.principal),
  currentBalance: parseMoneyFromCloud(r.current_balance),
  interestRate: Number(r.interest_rate),
  minimumPayment: parseMoneyFromCloud(r.minimum_payment),
  dueDate: r.due_date || undefined,
  currency: r.currency,
  direction: (r.direction as Debt['direction']) || 'owed_by_me',
  counterpartyName: r.counterparty_name || undefined,
  tenureMonths: r.extras?.tenureMonths,
  remainingMonths: r.extras?.remainingMonths,
  paymentLog: r.extras?.paymentLog as Debt['paymentLog'],
  updated_at: r.updated_at,   // TD-03 phase B — concurrency precondition
  ...rowToProv(r),
});

const assetToRow = (a: Partial<Asset>, hid: string): Partial<AssetRow> => ({
  ...provToRow(a),
  id: a.id, household_id: hid, type: a.type!, name: a.name!,
  value: a.value!, currency: a.currency || 'USD',
  liquidity: a.liquidity!, note: a.note || null,
  last_updated: a.lastUpdated || null,
});
const rowToAsset = (r: AssetRow): Asset => ({
  id: r.id, type: r.type, name: r.name,
  value: parseMoneyFromCloud(r.value), currency: r.currency,
  liquidity: r.liquidity as Asset['liquidity'],
  note: r.note || undefined,
  lastUpdated: r.last_updated || undefined,
  updated_at: r.updated_at,   // TD-03 phase B — concurrency precondition
  ...rowToProv(r),
});

const memberToRow = (m: Partial<Member>, hid: string): Partial<MembershipRow> => ({
  id: m.id, household_id: hid,
  user_id: m.userId ?? null,
  display_name: m.name!,
  household_role: m.role || 'primary',
  role: m.appRole || 'member',
});
const rowToMember = (r: MembershipRow): Member => ({
  id: r.id, name: r.display_name,
  role: (r.household_role || 'primary') as Member['role'],
  appRole: r.role as Member['appRole'],
  userId: r.user_id || undefined,
});

const accountToRow = (a: Partial<Account>, hid: string): Partial<AccountRow> => ({
  ...provToRow(a),
  id: a.id, household_id: hid,
  asset_id: a.assetId || null,
  kind: a.kind!,
  name: a.name!,
  currency: a.currency || 'USD',
  is_default: a.isDefault ?? false,
  is_archived: a.isArchived ?? false,
  opening_balance: a.openingBalance ?? 0,   // Money-Model B1.2
});
const rowToAccount = (r: AccountRow): Account => ({
  id: r.id,
  assetId: r.asset_id || undefined,
  kind: r.kind as Account['kind'],
  name: r.name,
  currency: r.currency,
  isDefault: r.is_default,
  isArchived: r.is_archived,
  openingBalance: r.opening_balance != null ? parseMoneyFromCloud(r.opening_balance) : 0,
  updated_at: r.updated_at,
  ...rowToProv(r),
});

const savedViewToRow = (v: Partial<SavedView>, hid: string): Partial<SavedViewRow> => ({
  id: v.id, household_id: hid,
  // user_id is filled in by the DB default / RLS check on insert; the
  // RPC and the column default come from auth.uid(). We don't supply it
  // client-side to avoid the policy mismatch path.
  page: v.page!,
  name: v.name!,
  filters: v.filters ?? {},
  is_shared: v.isShared ?? false,
});
const rowToSavedView = (r: SavedViewRow): SavedView => ({
  id: r.id,
  userId: r.user_id,
  page: r.page as SavedView['page'],
  name: r.name,
  filters: r.filters ?? {},
  isShared: r.is_shared,
  updated_at: r.updated_at,
});

// ── TD-03 — optimistic concurrency ────────────────────────────
//
// Thrown by `upsert` when the caller supplied an `expectedUpdatedAt`
// precondition that no longer matches the cloud row — i.e. someone else
// (another household member, another tab) has edited the same row since
// the caller read it. The HybridAdapter catches this, dead-letters the
// op to a separate localStorage bucket, and exposes `pendingConflictCount`
// so the consumer UI can surface a conflict toast (TD-03 phase B).
//
// Callers that don't pass `expectedUpdatedAt` see the legacy last-write-
// wins behaviour — no breakage.
export class ConcurrencyConflictError extends Error {
  override readonly name = 'ConcurrencyConflictError';
  constructor(
    public readonly entity: Entity,
    public readonly id: string,
    public readonly expectedUpdatedAt: string,
  ) {
    super(`Concurrency conflict on ${entity}/${id}: expected updated_at=${expectedUpdatedAt}, server has changed since.`);
  }
}

// ── Adapter ───────────────────────────────────────────────────
export class SupabaseAdapter implements DataAdapter {
  constructor(private sb: SupabaseClient) {}

  // ── households ─────────────────────────────────────────────
  async listHouseholds(): Promise<HouseholdMeta[]> {
    // v8 — `onboarding` is an additive column. If the deployed DB's my_households
    // view predates it (the view freezes its column list at creation), selecting
    // it 400s and would block the WHOLE app on load. Degrade gracefully: retry
    // without the column rather than letting household list fail. The companion
    // migration (20260606130000) is the real fix; this keeps the app resilient to
    // any environment where it hasn't landed yet.
    const BASE = 'id,name,type,base_currency,created_at';
    let rows: Record<string, unknown>[];
    const withOnboarding = await this.sb
      .from('my_households').select(`${BASE},onboarding`).order('created_at');
    if (withOnboarding.error) {
      const fallback = await this.sb
        .from('my_households').select(BASE).order('created_at');
      if (fallback.error) throw fallback.error;
      rows = (fallback.data || []) as Record<string, unknown>[];
    } else {
      rows = (withOnboarding.data || []) as Record<string, unknown>[];
    }
    return rows.map(r => ({
      id: r.id as string, name: r.name as string, type: r.type as ProfileTypeKey,
      baseCurrency: r.base_currency as string, createdAt: r.created_at as string,
      // per-household onboarding state (jsonb). '{}' default / absent → undefined.
      onboarding: r.onboarding && Object.keys(r.onboarding as object).length
        ? (r.onboarding as Record<string, unknown>) : undefined,
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
    if (patch.onboarding !== undefined) update.onboarding = patch.onboarding;  // v8
    const { data, error } = await this.sb.from('households').update(update).eq('id', id)
      .select('id,name,type,base_currency,created_at,onboarding').single();
    if (error) throw error;
    return { id: data.id, name: data.name, type: data.type as ProfileTypeKey,
             baseCurrency: data.base_currency, createdAt: data.created_at,
             onboarding: data.onboarding && Object.keys(data.onboarding).length
               ? (data.onboarding as Record<string, unknown>) : undefined };
  }

  async deleteHousehold(id: string): Promise<void> {
    const { error } = await this.sb.from('households').delete().eq('id', id);
    if (error) throw error;
  }

  async getActiveHousehold(): Promise<string> {
    // Prefer vt_ active profile, fall back to the legacy active profile key. If neither exists, pick the first.
    const lsRead = (await import('./localStorageCompat')).default.readString;
    return lsRead('active_profile') || (await this.listHouseholds())[0]?.id || '';
  }
  async setActiveHousehold(id: string): Promise<string> {
    const lsSet = (await import('./localStorageCompat')).default.setString;
    lsSet('active_profile', id);
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
      .select('display_name,default_currency,language,date_format,education_progress')
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
      educationProgress: (prof.education_progress as Profile['educationProgress']) || {},
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
    if (patch.educationProgress !== undefined) userPatch.education_progress = patch.educationProgress;
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
    const { data, error } = await this.sb.from(this.tableName(entity))
      .select('*').eq('household_id', householdId).is('deleted_at', null);
    if (error) throw error;
    const rows = data || [];
    if (entity === 'transactions') return rows.map(rowToTxn) as unknown as T[];
    if (entity === 'budgets')      return rows.map(rowToBudget) as unknown as T[];
    if (entity === 'goals')        return rows.map(rowToGoal) as unknown as T[];
    if (entity === 'debts')        return rows.map(rowToDebt) as unknown as T[];
    if (entity === 'assets')       return rows.map(rowToAsset) as unknown as T[];
    if (entity === 'accounts')     return rows.map(rowToAccount) as unknown as T[];
    if (entity === 'savedViews')   return rows.map(rowToSavedView) as unknown as T[];
    return [];
  }

  /**
   * TD-06 — incremental list. Returns only rows whose `updated_at >
   * since`, ordered ascending by `updated_at`, including soft-deleted
   * rows so the caller can propagate tombstones into its local cache.
   *
   *   { rows }        — live rows (deleted_at is null), domain-mapped.
   *   { tombstones }  — ids whose `deleted_at` is set; caller should
   *                     remove them from its cache.
   *   { maxUpdatedAt } — the largest `updated_at` observed in this
   *                     page, suitable as the next cursor. Null when
   *                     the response was empty.
   *
   * `members` is not supported (membership rows have no `updated_at`
   * column and the table is tiny). Callers should keep using `list`
   * for members.
   *
   * Requires the matching `(household_id, updated_at)` index added by
   * the TD-21+TD-06 migration. Without the index the query is still
   * correct but does a per-household seq-scan.
   */
  async listSince<T = unknown>(
    entity: Exclude<Entity, 'members'>,
    householdId: string,
    since: string,
    limit = 500,
  ): Promise<{ rows: T[]; tombstones: string[]; maxUpdatedAt: string | null }> {
    const { data, error } = await this.sb.from(this.tableName(entity))
      .select('*')
      .eq('household_id', householdId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    const all = (data || []) as Array<{ id: string; updated_at: string; deleted_at: string | null }>;
    const tombstones: string[] = [];
    const liveRaw: typeof all = [];
    let maxUpdatedAt: string | null = null;
    for (const r of all) {
      if (!maxUpdatedAt || r.updated_at > maxUpdatedAt) maxUpdatedAt = r.updated_at;
      if (r.deleted_at) tombstones.push(r.id);
      else liveRaw.push(r);
    }
    const rows = liveRaw.map(r => this.mapRowBack(entity, r)) as T[];
    return { rows, tombstones, maxUpdatedAt };
  }

  async upsert<T extends { id?: string } = { id?: string }>(entity: Entity, householdId: string, record: T, expectedUpdatedAt?: string): Promise<T & { id: string }> {
    let row: Record<string, unknown>;
    if      (entity === 'transactions') row = txnToRow   (record as Partial<Transaction>, householdId);
    else if (entity === 'budgets')      row = budgetToRow(record as Partial<Budget>,      householdId);
    else if (entity === 'goals')        row = goalToRow  (record as Partial<Goal>,        householdId);
    else if (entity === 'debts')        row = debtToRow  (record as Partial<Debt>,        householdId);
    else if (entity === 'assets')       row = assetToRow (record as Partial<Asset>,       householdId);
    else if (entity === 'accounts')     row = accountToRow(record as Partial<Account>,    householdId);
    else if (entity === 'savedViews')   row = savedViewToRow(record as Partial<SavedView>, householdId);
    else if (entity === 'members')      row = memberToRow(record as Partial<Member>,      householdId);
    else throw new Error(`Unknown entity: ${entity}`);

    const tableName = this.tableName(entity);

    // TD-03 — optimistic-concurrency path. When the caller supplies an
    // `expectedUpdatedAt` AND the record has an id (i.e. this is an edit,
    // not a new insert), we run a guarded UPDATE — `WHERE id = ? AND
    // updated_at = ?`. If zero rows match, someone else has bumped the row
    // since the caller's read and we throw `ConcurrencyConflictError` rather
    // than silently overwriting. `id` is preserved in the row body so the
    // existing PK is found.
    if (expectedUpdatedAt && row.id) {
      // Don't try to write `updated_at` ourselves — the DB's `touch_*`
      // trigger (schema.sql line 239) will set it to now() on every UPDATE.
      delete (row as Record<string, unknown>).updated_at;
      const { data, error } = await this.sb.from(tableName)
        .update(row)
        .eq('id', row.id as string)
        .eq('updated_at', expectedUpdatedAt)
        .select().maybeSingle();
      if (error) throw error;
      if (data === null) {
        // Zero rows matched the version precondition → conflict.
        throw new ConcurrencyConflictError(entity, row.id as string, expectedUpdatedAt);
      }
      return this.mapRowBack(entity, data) as T & { id: string };
    }

    // Legacy path (no version precondition supplied, or this is a new
    // insert): keep the real upsert (INSERT ... ON CONFLICT (id) DO UPDATE)
    // semantics. The previous implementation branched on `row.id` to do an
    // UPDATE ... WHERE id = ?, but locally-created records ALWAYS carry a
    // client-assigned id (the cache assigns one before queueing); the very
    // first sync of a new record then matched zero rows, `.single()` threw,
    // and the op sat in the sync queue forever. `.upsert()` inserts when
    // the row is new and updates when it already exists — exactly what the
    // queue contract needs.
    if (!row.id) delete row.id;
    const { data, error } = await this.sb.from(tableName)
      .upsert(row, { onConflict: 'id' })
      .select().single();
    if (error) throw error;
    return this.mapRowBack(entity, data) as T & { id: string };
  }

  async remove(entity: Entity, householdId: string, id: string): Promise<void> {
    const tableName = this.tableName(entity);
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
    // TD-09: prefer atomic server-side replace RPC for performance and
    // correctness. Each `replace_<entity>` RPC soft-deletes existing rows
    // and inserts the provided set inside a single transaction.
    const rpcName =
      entity === 'members'    ? 'replace_memberships' :
      entity === 'savedViews' ? 'replace_saved_views' :
      `replace_${entity}`;
    const payload = { h: householdId, rows: records } as Record<string, unknown>;
    const { data, error } = await this.sb.rpc(rpcName, payload as Record<string, unknown>);
    if (error) throw error;
    const rows = (data || []) as unknown[];
    return rows.map(r => this.mapRowBack(entity, r)) as T[];
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

  // ── v7.3 — Money Map Item #8 read-path optimisation ────────
  async queryTxnByMember(householdId: string) {
    const { data, error } = await this.sb.from('v_txn_by_member')
      .select('member_id,type,currency,total,n').eq('household_id', householdId);
    if (error) throw error;
    return (data || []).map(r => ({
      member_id: r.member_id as string | null,
      type: String(r.type),
      currency: String(r.currency),
      total: Number(r.total),
      n: Number(r.n),
    }));
  }
  async queryTxnByAccount(householdId: string) {
    const { data, error } = await this.sb.from('v_txn_by_account')
      .select('account_id,type,currency,total,n').eq('household_id', householdId);
    if (error) throw error;
    return (data || []).map(r => ({
      account_id: r.account_id as string | null,
      type: String(r.type),
      currency: String(r.currency),
      total: Number(r.total),
      n: Number(r.n),
    }));
  }

  // Private helper — convert a returned row back to its JS shape
  private mapRowBack(entity: Entity, row: unknown): unknown {
    if (entity === 'transactions') return rowToTxn   (row as TransactionRow);
    if (entity === 'budgets')      return rowToBudget(row as BudgetRow);
    if (entity === 'goals')        return rowToGoal  (row as GoalRow);
    if (entity === 'debts')        return rowToDebt  (row as DebtRow);
    if (entity === 'assets')       return rowToAsset (row as AssetRow);
    if (entity === 'accounts')     return rowToAccount(row as AccountRow);
    if (entity === 'savedViews')   return rowToSavedView(row as SavedViewRow);
    if (entity === 'members')      return rowToMember(row as MembershipRow);
    return row;
  }

  // Map an Entity to its actual Postgres table name. Most are 1:1; the
  // exceptions are `members` -> `memberships` (legacy v4.1 naming) and
  // `savedViews` -> `saved_views` (snake-case convention for new tables).
  private tableName(entity: Entity): string {
    if (entity === 'members')    return 'memberships';
    if (entity === 'savedViews') return 'saved_views';
    return entity;
  }

  // ── auth-adjacent helpers (used by store) ──────────────────
  // Note: actual auth methods (signIn/signUp) live in lib/auth.ts to keep
  // the adapter focused on data CRUD. Subscriptions for realtime are also
  // separate — see lib/realtime.ts.
}
