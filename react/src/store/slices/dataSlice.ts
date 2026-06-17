// Vyact — data-core slice (TD-25 final increment).
// Household-scoped entity state + bootstrap (init), the refresh stale-sequence
// guard, and every CRUD / money action. Composed into `useStore` by
// store/index.ts; reads/writes the rest of the store via get()/set().
import type { StateCreator } from 'zustand';
import type { Store } from '../../store';
import type {
  Transaction, Budget, BudgetAllocation, Goal, Member, Debt, Asset, Account, SavedView,
  Profile, ExchangeRates, HouseholdMeta,
  RecurringSchedule, PartPaymentChoice,
} from '../../types';
import { LocalStorageAdapter, type DataAdapter } from '../../lib/dataAdapter';
import { HybridAdapter } from '../../lib/hybridAdapter';
import { buildSeed } from '../../lib/seed';
import { DEFAULT_RATES } from '../../constants';
import { isCloudEnabled, supabase } from '../../lib/supabase';
import { applyPayment } from '../../lib/amortization';
import { autoMigrateAnonToHousehold } from '../../lib/migration';
import { backfillSchedulesFromTransactions } from '../../lib/recurring';
import { uid, setNumberSystem } from '../../lib/format';
import { readNumberSystemPref, writeNumberSystemPref } from '../../lib/numberSystemPref';
import {
  registerOnboardingSync, hydrateOnboardingFromCloud,
  type HouseholdOnboarding,
} from '../../lib/onboardingState';
import { accountValueOf } from '../../lib/accountBalance';
import { mergeProgress, writeLocalEducationProgress, readLocalEducationProgress } from '../../lib/educationProgress';
import { readLocalJson, readLocalString, setLocalString, removeLocal } from '../localJson';

export interface DataSlice {
  // ── data ────────────────────────────────────────────────────
  adapter: DataAdapter;
  households: HouseholdMeta[];
  currentHouseholdId: string;
  transactions: Transaction[];
  budgets: Budget[];
  /** v9.1 §4 — per-category sub-limits, keyed by budgetId. Cloud-synced child rows. */
  budgetAllocations: BudgetAllocation[];
  goals: Goal[];
  members: Member[];
  debts: Debt[];
  assets: Asset[];
  /** v7.1.2 — first-class accounts (Money Map). Populated for cloud
   *  households that have run the Phase 1 backfill; empty in legacy
   *  local-only mode. Consumers gate reads on `getMoneyMapMode()`. */
  accounts: Account[];
  /** v7.3 — per-user saved filter views (Money Map Item #4). Owner-
   *  scoped on the server via RLS; the array here is whatever the
   *  current user can see (their own + shared rows from household). */
  savedViews: SavedView[];
  profile: Profile;
  rates: ExchangeRates;

  // ── v7: recurring + notifications ───────────────────────────
  // recurringSchedules + notifications/prefs live in RecurringSlice / NotifySlice (TD-25).

  // cloud/auth (CloudAuthSlice) + theme/loading/toasts (SyncSlice) folded in via extends (TD-25).
  // Modal state (txn/goal/budget/debt/asset/account) lives in ModalSlice (TD-25).

  // ── actions ─────────────────────────────────────────────────
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  switchHousehold: (id: string) => Promise<void>;
  createHousehold: (name: string, type: HouseholdMeta['type'], baseCurrency: string) => Promise<HouseholdMeta>;
  deleteHousehold: (id: string) => Promise<void>;
  renameHousehold: (id: string, name: string) => Promise<void>;

  // CRUD
  upsertTransaction: (t: Partial<Transaction>) => Promise<Transaction>;
  removeTransaction: (id: string) => Promise<void>;
  upsertBudget: (b: Partial<Budget>) => Promise<Budget>;
  removeBudget: (id: string) => Promise<void>;
  /** v9.1 §4 — replace a budget's per-category allocations. */
  setBudgetAllocations: (budgetId: string, rows: Partial<BudgetAllocation>[]) => Promise<BudgetAllocation[]>;
  upsertGoal: (g: Partial<Goal>) => Promise<Goal>;
  removeGoal: (id: string) => Promise<void>;
  upsertMember: (m: Partial<Member>) => Promise<Member>;
  removeMember: (id: string) => Promise<void>;
  upsertDebt: (d: Partial<Debt>) => Promise<Debt>;
  removeDebt: (id: string) => Promise<void>;
  upsertAsset: (a: Partial<Asset>) => Promise<Asset>;
  removeAsset: (id: string) => Promise<void>;
  upsertAccount: (a: Partial<Account>) => Promise<Account>;
  // reconcileAccount lives in ReconcileSlice (store/slices/reconcileSlice.ts, TD-25).
  removeAccount: (id: string) => Promise<void>;
  upsertSavedView: (v: Partial<SavedView>) => Promise<SavedView>;
  removeSavedView: (id: string) => Promise<void>;

  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  /** v7.3 — Money Map Migration B. Mark a topic completed/dismissed and
   *  persist via the adapter. Caller passes either or both timestamps via
   *  the patch shape `{ completed_at?, dismissed_at? }` (defaults to now). */
  markEducation: (topicId: string, patch?: { completed_at?: string; dismissed_at?: string }) => Promise<void>;
  upsertRate: (code: string, rate: number) => Promise<void>;
  resetRates: () => Promise<void>;

  // v7 — recurring
  // recurring actions live in RecurringSlice (store/slices/recurringSlice.ts, TD-25).

  // v7 — notifications
  // notification actions live in NotifySlice (store/slices/notifySlice.ts, TD-25).

  // v7 — debt payment with re-amortisation
  recordDebtPayment: (debtId: string, amount: number, choice?: PartPaymentChoice) => Promise<{ message: string; debt: Debt | null }>;

  // auth lifecycle (CloudAuthSlice) + sync surface / theme / toast (SyncSlice)
  // are folded in via `extends` (TD-25).
}

const defaultProfile: Profile = {
  name: '', email: '', baseCurrency: 'USD', language: 'en',
  household: 'family', dateFormat: 'us', numberSystem: 'western',
  payoffStrategy: 'avalanche', extraPayment: 0,
};

// readLocalJson/readLocalString/setLocalJson/setLocalString/removeLocal moved to
// store/localJson.ts (TD-25) so extracted slices can share them.

// v8.1.2 — monotonically increasing refresh sequence. Module-scoped (not store
// state) so bumping it never triggers a re-render. refresh() uses it to discard
// stale, out-of-order completions (see refresh()).
let refreshSeq = 0;

// Adapter selector: HybridAdapter when cloud env is set, otherwise LocalStorageAdapter.
// The store calls adapter methods; the rest of the app doesn't know which is in use.
const initialAdapter: DataAdapter = (isCloudEnabled() && supabase)
  ? new HybridAdapter(supabase)
  : new LocalStorageAdapter();

export const createDataSlice: StateCreator<Store, [], [], DataSlice> = (set, get) => ({
  adapter: initialAdapter,
  households: [],
  currentHouseholdId: 'local',
  transactions: [], budgets: [], budgetAllocations: [], goals: [], members: [], debts: [], assets: [], accounts: [],
  savedViews: [],
  profile: defaultProfile,
  rates: { ...DEFAULT_RATES },

  // cloud/auth state (CloudAuthSlice), theme/loading/toasts (SyncSlice), and the
  // modal/reconcile/notify/recurring slices are composed via the spreads above.

  init: async () => {
    const { adapter, cloudEnabled, session } = get();
    set({ loading: true });
    // In cloud mode, only initialise data if we have a session.
    // Otherwise the AuthGate will route to sign-in and call init again post-auth.
    if (cloudEnabled && !session) {
      set({ loading: false });
      return;
    }
    const households = await adapter.listHouseholds();
    const activeHouseholdId = await adapter.getActiveHousehold();
    // v6.4: Prefer the household the user was last viewing in cloud mode.
    // The last cloud household id is stored on sign-out so a fresh sign-in lands
    // on the same household whose cache (legacy per-household keys) we still hold locally.
    const lastCloudHid = (cloudEnabled && typeof localStorage !== 'undefined')
      ? readLocalString('last_cloud_hid', null)
      : null;
    const preferredId = lastCloudHid && households.some(h => h.id === lastCloudHid)
      ? lastCloudHid
      : activeHouseholdId;
    const active = households.length
      ? (households.find(h => h.id === preferredId)?.id || households[0].id)
      : 'local';
    set({ households, currentHouseholdId: active });

    // v8 — onboarding cloud sync. In cloud mode, write-throughs persist the
    // per-household state to `households.onboarding`; hydrate the local cache
    // from the authoritative cloud value so a second device reflects it. In
    // local-only mode the localStorage cache is already durable → no persister.
    if (cloudEnabled) {
      registerOnboardingSync((hid, rec) => {
        if (hid === 'local') return;
        void adapter.updateHousehold(hid, { onboarding: rec as unknown as Record<string, unknown> })
          .catch(e => { if (typeof console !== 'undefined') console.warn('[Vyact] onboarding sync failed', e); });
      });
      for (const h of households) {
        hydrateOnboardingFromCloud(h.id, h.onboarding as Partial<HouseholdOnboarding> | undefined);
      }
    } else {
      registerOnboardingSync(null);
    }

    if (cloudEnabled && active !== 'local') {
      try { setLocalString('last_cloud_hid', active); } catch { /* noop */ }
    }
    await get().refresh();

    // First-run seed (local mode only — cloud users get an empty household)
    const { transactions, budgets, members } = get();
    if (!cloudEnabled && !transactions.length && !budgets.length && !members.length && active === 'local') {
      const seed = buildSeed();
      await adapter.replaceAll('transactions', active, seed.transactions);
      await adapter.replaceAll('budgets',      active, seed.budgets);
      await adapter.replaceAll('goals',        active, seed.goals);
      await adapter.replaceAll('members',      active, seed.members);
      await adapter.replaceAll('debts',        active, seed.debts);
      await adapter.replaceAll('assets',       active, seed.assets);
      await adapter.updateProfile(active, seed.profile);
      for (const [code, rate] of Object.entries(seed.exchangeRates)) {
        await adapter.upsertRate(active, code, rate);
      }
      await get().refresh();
    }
    // v6.4: One-shot anon → cloud migration when the user signs in for the
    // first time on this device and lands on an empty cloud household.
    if (cloudEnabled && active !== 'local') {
      try {
        const result = await autoMigrateAnonToHousehold(adapter, active);
        if (result.ran && result.counts) {
          const total = Object.values(result.counts).reduce((s, n) => s + n, 0);
          get().toast(`Imported ${total} item${total === 1 ? '' : 's'} from local data`, 'success');
          await get().refresh();
        }
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[Vyact] auto-migration failed', e);
      }
    }
    // v8.9 — one-shot migration of the pre-cloud localStorage recurring list
    // (legacy global `recurring` key) into the household-scoped synced entity.
    // Runs only when the household has no recurring rows yet but legacy data
    // exists; idempotent thereafter.
    try {
      const legacy = readLocalJson<RecurringSchedule[]>('recurring', []);
      if (legacy.length && get().recurringSchedules.length === 0) {
        for (const s of legacy) {
          try { await adapter.upsert('recurring', active, s); } catch { /* best-effort */ }
        }
        removeLocal('recurring');             // retire the legacy global key after migrating
        set({ recurringSchedules: await adapter.list<RecurringSchedule>('recurring', active) });
      }
    } catch { /* migration is best-effort */ }

    // v7: run recurring + refresh notifications on every load
    await get().runRecurringEngine();
    get().refreshNotifications();

    set({ loading: false });
  },

  refresh: async () => {
    const { adapter, currentHouseholdId } = get();
    // v8.1.2 — realtime fires refresh() on every postgres change, so multiple
    // refreshes can be in flight at once. Capture a sequence number + the active
    // household; after the awaits, bail if a NEWER refresh has started or the
    // household has switched. Without this, an older snapshot (e.g. a cloud read
    // that lagged a just-written row) can resolve last and clobber newer state,
    // which is what made the dashboard totals freeze after a couple of txns.
    const seq = ++refreshSeq;
    const seqHid = currentHouseholdId;
    const isStale = () => seq !== refreshSeq || get().currentHouseholdId !== seqHid;
    const [transactions, budgets, goals, members, debts, assets, accounts, savedViews, recurringList, budgetAllocations, profile, rates] = await Promise.all([
      adapter.list<Transaction>('transactions', currentHouseholdId),
      adapter.list<Budget>('budgets',           currentHouseholdId),
      adapter.list<Goal>('goals',               currentHouseholdId),
      adapter.list<Member>('members',           currentHouseholdId),
      adapter.list<Debt>('debts',               currentHouseholdId),
      adapter.list<Asset>('assets',             currentHouseholdId),
      adapter.list<Account>('accounts',         currentHouseholdId),
      adapter.list<SavedView>('savedViews',     currentHouseholdId).catch(() => [] as SavedView[]),
      adapter.list<RecurringSchedule>('recurring', currentHouseholdId).catch(() => [] as RecurringSchedule[]),
      adapter.list<BudgetAllocation>('budgetAllocations', currentHouseholdId).catch(() => [] as BudgetAllocation[]),
      adapter.getProfile(currentHouseholdId),
      adapter.getRates(currentHouseholdId),
    ]);
    // v6.4: hydrate per-budget local period metadata (DB schema lacks an
    // extras column on budgets so period info is a client-side overlay).
    // Removed 2026-06-01: PR #20 added the real `period` / `period_start` /
    // `period_end` columns to `budgets`; the adapter row mapper now returns
    // them directly and the local overlay is dead code.
    // Drop this result if a newer refresh superseded it (or the household
    // switched) while our reads were in flight — applying it would overwrite
    // fresher data with a stale snapshot.
    if (isStale()) return;
    const hydratedBudgets = budgets;
    // v6.4: Defensive — if every entity comes back empty AND we previously
    // had data in memory, the cloud is almost certainly degraded (RLS issue,
    // schema not deployed, transient outage). Hold the last-known state and
    // surface a warning instead of presenting a blank app to the user, who
    // would otherwise assume their data has been deleted.
    const prev = get();
    const allEmpty = !transactions.length && !budgets.length && !goals.length &&
      !members.length && !debts.length && !assets.length;
    const prevHadData = (prev.transactions.length + prev.budgets.length + prev.goals.length +
      prev.members.length + prev.debts.length + prev.assets.length) > 0;
    if (allEmpty && prevHadData && prev.currentHouseholdId === currentHouseholdId) {
      // Refresh in-memory profile + rates only; keep entity arrays as-is.
      const overlaidNs = readNumberSystemPref(currentHouseholdId);
      const baseProfile = profile ? { ...defaultProfile, ...profile } : prev.profile;
      const mergedProfile = overlaidNs ? { ...baseProfile, numberSystem: overlaidNs } : baseProfile;
      set({
        profile: mergedProfile,
        rates: rates && Object.keys(rates).length ? rates : prev.rates,
      });
      setNumberSystem(mergedProfile.numberSystem === 'indian' ? 'indian' : 'western');
      prev.toast('Cloud sync looked empty — keeping local data. Use Force Resync if needed.', 'warning');
      return;
    }
    const overlaidNs = readNumberSystemPref(currentHouseholdId);
    const baseProfile = profile
      ? { ...defaultProfile, ...profile, educationProgress: profile.educationProgress ?? readLocalEducationProgress() }
      : { ...defaultProfile, educationProgress: readLocalEducationProgress() };
    const mergedProfile = overlaidNs ? { ...baseProfile, numberSystem: overlaidNs } : baseProfile;
    set({
      transactions, budgets: hydratedBudgets, goals, members, debts, assets, accounts, savedViews,
      recurringSchedules: recurringList,
      budgetAllocations,
      profile: mergedProfile,
      rates,
      lastSyncedAt: Date.now(),   // R4 (sync fix): drives "last synced" status
    });
    setNumberSystem(get().profile.numberSystem === 'indian' ? 'indian' : 'western');

    // v7.3 — Backfill RecurringSchedule rows for legacy txns whose `recurring`
    // field is set but never produced a schedule. v8.9 — recurring is now a
    // household-scoped, synced entity, so persist new rows through the adapter
    // (was localStorage-only) so they reach the cloud + other devices.
    const { schedules: nextSchedules, added } = backfillSchedulesFromTransactions(
      transactions,
      recurringList,
    );
    if (added > 0) {
      const fresh = nextSchedules.filter(s => !recurringList.some(r => r.id === s.id));
      for (const s of fresh) {
        try { await adapter.upsert('recurring', currentHouseholdId, s); } catch { /* best-effort */ }
      }
      set({ recurringSchedules: nextSchedules });
      get().toast(`Recovered ${added} recurring schedule${added === 1 ? '' : 's'} from existing transactions`, 'info');
    }
  },

  switchHousehold: async (id) => {
    const { adapter, cloudEnabled } = get();
    await adapter.setActiveHousehold(id);
    set({ currentHouseholdId: id });
    if (cloudEnabled && id !== 'local') {
      try { setLocalString('last_cloud_hid', id); } catch { /* noop */ }
    }
    await get().refresh();
    get().toast('Switched profile', 'success');
  },

  createHousehold: async (name, type, baseCurrency) => {
    const { adapter } = get();
    const h = await adapter.createHousehold(name, type, baseCurrency);
    await adapter.updateProfile(h.id, { ...defaultProfile, baseCurrency, household: type });
    for (const [code, rate] of Object.entries(DEFAULT_RATES)) {
      await adapter.upsertRate(h.id, code, rate);
    }
    const households = await adapter.listHouseholds();
    set({ households });
    await get().switchHousehold(h.id);
    return h;
  },

  deleteHousehold: async (id) => {
    const { adapter, currentHouseholdId } = get();
    if (id === currentHouseholdId) await get().switchHousehold('local');
    await adapter.deleteHousehold(id);
    set({ households: await adapter.listHouseholds() });
    get().toast('Profile deleted', 'warning');
  },

  renameHousehold: async (id, name) => {
    const { adapter } = get();
    await adapter.updateHousehold(id, { name });
    set({ households: await adapter.listHouseholds() });
  },

  // ── CRUD ─────────────────────────────────────────────────────
  upsertTransaction: async (t) => {
    const { adapter, currentHouseholdId, transactions, accounts } = get();

    // Money-Model B1.1 (A2) — no transaction without an account. Default the
    // funding source to the system Cash account so the rule never blocks fast entry.
    if (!t.id) {
      if ((t.type === 'expense' || t.type === 'income' || t.type === 'transfer')
          && !t.accountId && !t.paymentMethod) {
        t = { ...t, accountId: 'cash', paymentMethod: 'cash' };
      }
    }

    // v9 §2.4 — resolve the encoded picker values ('cash' / 'asset:<id>' /
    // 'debt:<id>') to real account uuids so the FK matrix holds. The encoded
    // string stays in paymentMethod for display compatibility.
    const resolveUuid = (v: string | undefined): string | undefined => {
      if (!v) return undefined;
      const acc = accounts.find(a => a.id === v || accountValueOf(a) === v);
      return acc?.id;
    };
    const fromUuid = resolveUuid(t.accountId ?? t.paymentMethod);
    const toUuid   = resolveUuid(t.toAccountId ?? t.linkedToAssetId);
    if (t.type === 'expense') {
      t = { ...t, accountId: fromUuid ?? t.accountId, toAccountId: undefined };
    } else if (t.type === 'income') {
      t = { ...t, accountId: undefined, toAccountId: toUuid ?? fromUuid ?? t.accountId };
    } else if (t.type === 'transfer' || t.type === 'investment') {
      // v9 D1 — transfers/investments are ONE row with both FKs; no category.
      t = { ...t, category: '', accountId: fromUuid ?? t.accountId, toAccountId: toUuid ?? t.toAccountId };
      // §4.4 guard: from ≠ to.
      if (t.accountId && t.accountId === t.toAccountId) {
        throw new Error('Transfer needs two different accounts');
      }
    }

    // v9 §4.1/§6.3 — loan_emi SYSTEM_SPLIT: book the interest portion as the
    // expense (counts as spend) and a system transfer leg for the principal
    // (reduces the linked debt; excluded from spend). Best-effort sequential —
    // the principal leg + debt update follow the expense write.
    // v9.4.2 — now uses applyPayment() for full re-amortisation (tenure / EMI /
    // advance) and paymentLog recording, converging the two payment paths.
    if (!t.id && t.type === 'expense' && t.category === 'loan_emi' && t.linkedDebtId && t.amount) {
      const debt = get().debts.find(d => d.id === t.linkedDebtId);
      if (debt) {
        // Read the part-payment strategy from the transient form field.
        const partChoice = (t as any)._partPaymentChoice as PartPaymentChoice | undefined;
        // Full re-amortisation: applyPayment handles interest/principal split,
        // balance reduction, tenure/EMI recalculation, and paymentLog.
        const result = applyPayment(debt, t.amount, partChoice);
        const { interest, principal } = result.log;
        const emiSplit = { interest, principal, debt_id: debt.id, partPaymentChoice: partChoice };

        // 1) interest leg — the visible expense (only this counts as spend, R-AGG-6)
        const expense = await adapter.upsert('transactions', currentHouseholdId, {
          ...t, id: uid(), amount: interest, emiSplit,
          _partPaymentChoice: undefined,  // strip transient field
        });
        // 2) principal leg — system transfer into the loan (liability) account
        //    (display-kind loan_principal). Find-or-create a kind='loan' account
        //    linked to the debt so the leg has a real destination.
        let loanAcc = get().accounts.find(a => a.kind === 'loan' && a.assetId === debt.id);
        if (!loanAcc) {
          loanAcc = await get().upsertAccount({
            id: uid(), kind: 'loan', name: debt.name, currency: debt.currency,
            assetId: debt.id, isDefault: false, isArchived: false,
          });
        }
        const principalLeg = await adapter.upsert('transactions', currentHouseholdId, {
          ...t, id: uid(), type: 'transfer' as const, category: '', amount: principal,
          toAccountId: loanAcc.id, description: `${t.description || 'EMI'} — principal`,
          emiSplit, linkedTxnId: (expense as Transaction).id,
          _partPaymentChoice: undefined,
        });
        // 3) persist the re-amortised debt (balance, remainingMonths, EMI, paymentLog)
        await get().upsertDebt(result.debt);
        set({ transactions: [...get().transactions, expense as Transaction, principalLeg as Transaction] });
        // Surface the re-amortisation message as a toast.
        if (result.message) get().toast(result.message, 'success');
        return expense as Transaction;
      }
    }

    // TD-03 phase A (PR #11): when this is an EDIT of an existing txn
    // (we have both an id and a known updated_at from a prior read),
    // pass the version as the optimistic-concurrency precondition so
    // the cloud rejects the write if someone else has edited the same
    // row in the meantime. New txns (no updated_at yet) keep the legacy
    // last-write-wins insert path.
    const expectedUpdatedAt = t.id && t.updated_at ? t.updated_at : undefined;
    const saved = await adapter.upsert('transactions', currentHouseholdId, t, expectedUpdatedAt);
    const idx = transactions.findIndex(x => x.id === saved.id);
    set({ transactions: idx >= 0 ? transactions.map(x => x.id === saved.id ? saved as Transaction : x) : [...transactions, saved as Transaction] });
    return saved as Transaction;
  },
  removeTransaction: async (id) => {
    const { adapter, currentHouseholdId, transactions } = get();
    // v7.0.3 — Transfer pair: deleting either half removes the other half too.
    const target = transactions.find(x => x.id === id);
    const tag = target?.note?.match(/__tg:[A-Za-z0-9_-]+/)?.[0];
    if (tag) {
      const pair = transactions.filter(x => x.note?.includes(tag));
      await Promise.all(pair.map(p => adapter.remove('transactions', currentHouseholdId, p.id)));
      set({ transactions: transactions.filter(x => !x.note?.includes(tag)) });
      return;
    }
    await adapter.remove('transactions', currentHouseholdId, id);
    set({ transactions: transactions.filter(x => x.id !== id) });
  },
  upsertBudget: async (b) => {
    const { adapter, currentHouseholdId, budgets } = get();
    // v9.3.3 — the DB owns budget identity (household, scope, period), enforced by
    // uq_budget_month/uq_budget_annual. A NEW budget goes through the identity-aware
    // create authority (`createBudgetChecked` → upsert_budget RPC): it assigns the
    // id and rejects a duplicate slot — including another member's unsynced one —
    // with BudgetExistsError, rather than minting a client id that collides and
    // dead-letters. An EDIT keeps its id and uses the concurrency-safe update path.
    // (The v9.3.1 deterministic-id approach was removed: coupling PK to identity
    // broke delete+recreate and clashed with recovered random-id rows.)
    let saved: Budget;
    if (!b.id) {
      saved = await adapter.createBudgetChecked(currentHouseholdId, b);
    } else {
      saved = await adapter.upsert('budgets', currentHouseholdId, b, b.updated_at ? b.updated_at : undefined) as Budget;
    }
    // Period metadata now lives on the row itself (PR #20). The adapter's
    // rowToBudget mapper returns `period` / `periodStart` / `periodEnd`.
    const merged: Budget = { ...saved, period: saved.period || b.period || 'monthly' };
    const idx = budgets.findIndex(x => x.id === saved.id);
    set({ budgets: idx >= 0 ? budgets.map(x => x.id === saved.id ? merged : x) : [...budgets, merged] });
    return merged;
  },
  removeBudget: async (id) => {
    const { adapter, currentHouseholdId, budgets, budgetAllocations } = get();
    await adapter.remove('budgets', currentHouseholdId, id);
    // Cascade allocations locally (DB cascades via FK on delete; soft-delete
    // here just drops them from memory).
    set({
      budgets: budgets.filter(x => x.id !== id),
      budgetAllocations: budgetAllocations.filter(a => a.budgetId !== id),
    });
  },
  // v9.1 §4 — replace the full per-category allocation set for one budget.
  setBudgetAllocations: async (budgetId, rows) => {
    const { adapter, currentHouseholdId, budgetAllocations } = get();
    const others = budgetAllocations.filter(a => a.budgetId !== budgetId);
    const saved: BudgetAllocation[] = [];
    // remove allocations the user dropped
    const keepIds = new Set(rows.filter(r => r.id).map(r => r.id));
    for (const a of budgetAllocations.filter(a => a.budgetId === budgetId)) {
      if (!keepIds.has(a.id)) await adapter.remove('budgetAllocations', currentHouseholdId, a.id);
    }
    // upsert the current set
    for (const r of rows) {
      const row = await adapter.upsert('budgetAllocations', currentHouseholdId, { ...r, budgetId });
      saved.push(row as BudgetAllocation);
    }
    set({ budgetAllocations: [...others, ...saved] });
    return saved;
  },
  upsertGoal: async (g) => {
    const { adapter, currentHouseholdId, goals } = get();
    // TD-03 phase B (PR #12): thread the version precondition on edits.
    const saved = await adapter.upsert('goals', currentHouseholdId, g, g.id && g.updated_at ? g.updated_at : undefined);
    const idx = goals.findIndex(x => x.id === saved.id);
    set({ goals: idx >= 0 ? goals.map(x => x.id === saved.id ? saved as Goal : x) : [...goals, saved as Goal] });
    return saved as Goal;
  },
  removeGoal: async (id) => {
    const { adapter, currentHouseholdId, goals } = get();
    await adapter.remove('goals', currentHouseholdId, id);
    set({ goals: goals.filter(x => x.id !== id) });
  },
  upsertMember: async (m) => {
    const { adapter, currentHouseholdId, members } = get();
    const saved = await adapter.upsert('members', currentHouseholdId, m);
    const idx = members.findIndex(x => x.id === saved.id);
    set({ members: idx >= 0 ? members.map(x => x.id === saved.id ? saved as Member : x) : [...members, saved as Member] });
    return saved as Member;
  },
  removeMember: async (id) => {
    const { adapter, currentHouseholdId, members, transactions } = get();
    // Orphan linked transactions
    const linked = transactions.filter(t => t.memberId === id);
    for (const t of linked) {
      const updated = { ...t, memberId: '' };
      await adapter.upsert('transactions', currentHouseholdId, updated);
    }
    await adapter.remove('members', currentHouseholdId, id);
    set({
      members: members.filter(x => x.id !== id),
      transactions: transactions.map(t => t.memberId === id ? { ...t, memberId: '' } : t),
    });
  },
  upsertDebt: async (d) => {
    const { adapter, currentHouseholdId, debts } = get();
    // TD-03 phase B (PR #12): thread the version precondition on edits.
    const saved = await adapter.upsert('debts', currentHouseholdId, d, d.id && d.updated_at ? d.updated_at : undefined);
    const idx = debts.findIndex(x => x.id === saved.id);
    set({ debts: idx >= 0 ? debts.map(x => x.id === saved.id ? saved as Debt : x) : [...debts, saved as Debt] });
    return saved as Debt;
  },
  removeDebt: async (id) => {
    const { adapter, currentHouseholdId, debts } = get();
    await adapter.remove('debts', currentHouseholdId, id);
    set({ debts: debts.filter(x => x.id !== id) });
  },
  upsertAsset: async (a) => {
    const { adapter, currentHouseholdId, assets } = get();
    // TD-03 phase B (PR #12): thread the version precondition on edits.
    const saved = await adapter.upsert('assets', currentHouseholdId, a, a.id && a.updated_at ? a.updated_at : undefined);
    const idx = assets.findIndex(x => x.id === saved.id);
    set({ assets: idx >= 0 ? assets.map(x => x.id === saved.id ? saved as Asset : x) : [...assets, saved as Asset] });
    return saved as Asset;
  },
  removeAsset: async (id) => {
    const { adapter, currentHouseholdId, assets } = get();
    await adapter.remove('assets', currentHouseholdId, id);
    set({ assets: assets.filter(x => x.id !== id) });
  },
  upsertAccount: async (a) => {
    const { adapter, currentHouseholdId, accounts } = get();
    const isNew = !a.id || !accounts.find(x => x.id === a.id);

    // v9.4.2 — when creating a NEW investment account with no backing asset,
    // auto-create a corresponding Asset so the investment appears on Net Worth.
    // The `assetId` FK chain (accountValueOf → 'asset:<assetId>') feeds balances
    // into the Net Worth calculation automatically.
    if (isNew && a.kind === 'investment' && !a.assetId) {
      const backingAsset = await get().upsertAsset({
        id: uid(),
        type: 'investment',
        name: a.name || 'Investment',
        value: (a as any).openingBalance || 0,
        currency: a.currency || get().profile.baseCurrency,
        liquidity: 'short',
      });
      a = { ...a, assetId: backingAsset.id };
    }

    const saved = await adapter.upsert('accounts', currentHouseholdId, a, a.id && a.updated_at ? a.updated_at : undefined);
    const idx = accounts.findIndex(x => x.id === saved.id);
    set({ accounts: idx >= 0 ? accounts.map(x => x.id === saved.id ? saved as Account : x) : [...accounts, saved as Account] });
    return saved as Account;
  },
  removeAccount: async (id) => {
    const { adapter, currentHouseholdId, accounts } = get();
    await adapter.remove('accounts', currentHouseholdId, id);
    set({ accounts: accounts.filter(x => x.id !== id) });
  },
  upsertSavedView: async (v) => {
    const { adapter, currentHouseholdId, savedViews } = get();
    const saved = await adapter.upsert('savedViews', currentHouseholdId, v, v.id && v.updated_at ? v.updated_at : undefined);
    const idx = savedViews.findIndex(x => x.id === saved.id);
    set({ savedViews: idx >= 0 ? savedViews.map(x => x.id === saved.id ? saved as SavedView : x) : [...savedViews, saved as SavedView] });
    return saved as SavedView;
  },
  removeSavedView: async (id) => {
    const { adapter, currentHouseholdId, savedViews } = get();
    await adapter.remove('savedViews', currentHouseholdId, id);
    set({ savedViews: savedViews.filter(x => x.id !== id) });
  },

  updateProfile: async (patch) => {
    const { adapter, currentHouseholdId, profile } = get();
    // v7.4.4 — numberSystem is not yet a DB column. Persist locally,
    // strip from the cloud patch so the adapter doesn't drop other fields,
    // and apply immediately.
    let nsOverride: 'western' | 'indian' | undefined;
    let cloudPatch: typeof patch = patch;
    if (patch.numberSystem !== undefined) {
      nsOverride = patch.numberSystem;
      writeNumberSystemPref(currentHouseholdId, nsOverride);
      const { numberSystem: _ns, ...rest } = patch;
      cloudPatch = rest;
    }
    const next = Object.keys(cloudPatch).length
      ? await adapter.updateProfile(currentHouseholdId, cloudPatch)
      : profile;
    const merged = { ...profile, ...next, ...(nsOverride ? { numberSystem: nsOverride } : {}) };
    // v8.1.2 — household-level fields (base currency, type) also live on the
    // HouseholdMeta list that the profile switcher / menu drawer reads. Keep that
    // list in sync so the drawer's "· {currency}" label updates immediately
    // instead of staying stale until the next full reload.
    const households = (patch.baseCurrency !== undefined || patch.household !== undefined)
      ? get().households.map(h => h.id === currentHouseholdId
          ? { ...h,
              baseCurrency: patch.baseCurrency ?? h.baseCurrency,
              type: (patch.household ?? h.type) as HouseholdMeta['type'] }
          : h)
      : get().households;
    set({ profile: merged, households });
    setNumberSystem(merged.numberSystem === 'indian' ? 'indian' : 'western');
  },
  markEducation: async (topicId, patch) => {
    const { profile, cloudEnabled } = get();
    const ts = new Date().toISOString();
    const topic = { ...(patch?.completed_at ? { completed_at: patch.completed_at } : { completed_at: ts }), ...(patch?.dismissed_at ? { dismissed_at: patch.dismissed_at } : {}) };
    // If neither key was supplied, default to completed.
    const finalTopic = patch && (patch.completed_at || patch.dismissed_at) ? patch : topic;
    const nextProgress = mergeProgress(profile.educationProgress ?? {}, topicId, finalTopic);
    set({ profile: { ...profile, educationProgress: nextProgress } });
    if (cloudEnabled) {
      try { await get().updateProfile({ educationProgress: nextProgress }); } catch { /* swallow — local copy already set */ }
    } else {
      writeLocalEducationProgress(nextProgress);
    }
  },
  upsertRate: async (code, rate) => {
    const { adapter, currentHouseholdId, rates } = get();
    await adapter.upsertRate(currentHouseholdId, code, rate);
    set({ rates: { ...rates, [code]: rate } });
  },
  resetRates: async () => {
    const { adapter, currentHouseholdId } = get();
    for (const [code, rate] of Object.entries(DEFAULT_RATES)) {
      await adapter.upsertRate(currentHouseholdId, code, rate);
    }
    set({ rates: { ...DEFAULT_RATES } });
  },

  // ── v7: DEBT PAYMENT WITH RE-AMORTISATION ────────────────────
  recordDebtPayment: async (debtId, amount, choice) => {
    const debt = get().debts.find(d => d.id === debtId);
    if (!debt) return { message: 'Debt not found', debt: null };
    const result = applyPayment(debt, amount, choice);
    await get().upsertDebt(result.debt);

    // Generate the two transactions per v5 design: interest = expense, principal = transfer
    const linkId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const date = new Date().toISOString().split('T')[0];
    if (result.log.interest > 0.005) {
      await get().upsertTransaction({
        type: 'expense', amount: +result.log.interest.toFixed(2), date,
        description: `${debt.name} — interest`,
        category: 'debt_interest',
        currency: debt.currency,
        linkedDebtId: debt.id,
        linkedTxnId: linkId,
      });
    }
    if (result.log.principal > 0.005) {
      await get().upsertTransaction({
        type: 'transfer', amount: +result.log.principal.toFixed(2), date,
        description: `${debt.name} — principal`,
        category: 'debt_principal',
        currency: debt.currency,
        linkedDebtId: debt.id,
        linkedTxnId: linkId,
      });
    }
    return { message: result.message, debt: result.debt };
  },

});
