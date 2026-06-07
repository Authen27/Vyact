// Vyact v6 — Zustand global store
// All state + every CRUD action goes through here.
// CRUD actions persist via DataAdapter, then update in-memory state.

import { create } from 'zustand';
import type {
  Transaction, Budget, Goal, Member, Debt, Asset, Account, SavedView,
  Profile, ExchangeRates, HouseholdMeta, Theme,
  RecurringSchedule, Notification, NotificationPrefs, PartPaymentChoice,
} from './types';
import type { Session } from '@supabase/supabase-js';
import { LocalStorageAdapter, type DataAdapter } from './lib/dataAdapter';
import { HybridAdapter } from './lib/hybridAdapter';
import { buildSeed } from './lib/seed';
import { DEFAULT_RATES } from './constants';
import { isCloudEnabled, supabase } from './lib/supabase';
import { highestRole } from './lib/permissions';
import type { AppRole } from './types';
import { applyPayment } from './lib/amortization';
import { autoMigrateAnonToHousehold } from './lib/migration';
import {
  dueSchedules, generateTransaction, advanceSchedule,
  backfillSchedulesFromTransactions,
} from './lib/recurring';
import { uid, today, setNumberSystem } from './lib/format';
import { readNumberSystemPref, writeNumberSystemPref } from './lib/numberSystemPref';
import {
  upcomingBillNotifs, missedPaymentNotifs, budgetThresholdNotifs,
  goalMilestoneNotifs, DEFAULT_PREFS, isInQuietHours, showWebPush,
} from './lib/notifications';
import ls from './lib/localStorageCompat';
import { getMoneyMapMode } from './lib/featureFlags';
import {
  registerOnboardingSync, hydrateOnboardingFromCloud,
  type HouseholdOnboarding,
} from './lib/onboardingState';
import {
  computeAccountBalance, accountValueOf,
  reconcileAccount as buildReconcileAdjustment,
} from './lib/accountBalance';
import { mergeProgress, writeLocalEducationProgress, readLocalEducationProgress } from './lib/educationProgress';

interface ToastMsg { id: string; text: string; type: 'success'|'error'|'info'|'warning'; }

interface Store {
  // ── data ────────────────────────────────────────────────────
  adapter: DataAdapter;
  households: HouseholdMeta[];
  currentHouseholdId: string;
  transactions: Transaction[];
  budgets: Budget[];
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
  recurringSchedules: RecurringSchedule[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs;

  // ── v4.1: cloud + auth ───────────────────────────────────────
  cloudEnabled: boolean;
  session: Session | null;
  sessionLoaded: boolean;
  myRole: AppRole | undefined;          // role in active household

  // ── ui ──────────────────────────────────────────────────────
  theme: Theme;
  loading: boolean;
  toasts: ToastMsg[];

  // ── v6.2.3: global transaction modal ────────────────────────
  // Mounted once at App root so any page (Dashboard, Transactions, sidebar
  // shortcut N) can trigger it via the store without prop-drilling.
  txnModalOpen: boolean;
  editingTxn: Transaction | null;
  /** v7.4.5 — Ask Vyact intent flow seeds the Add-Transaction modal with
   *  partial values (e.g. `{ type: 'expense', category: 'groceries' }`)
   *  so two taps in Chat finish at a pre-filled form. Cleared on close. */
  seedTxn: Partial<Transaction> | null;
  openAddTxn: (seed?: Partial<Transaction>) => void;
  openEditTxn: (t: Transaction) => void;
  closeTxnModal: () => void;

  // ── v6.4: global goal & budget modals ───────────────────────
  goalModalOpen: boolean;
  editingGoal: Goal | null;
  openAddGoal: () => void;
  openEditGoal: (g: Goal) => void;
  closeGoalModal: () => void;

  goalProgressModalOpen: boolean;
  progressGoal: Goal | null;
  openGoalProgress: (g: Goal) => void;
  closeGoalProgress: () => void;

  budgetModalOpen: boolean;
  editingBudget: Budget | null;
  openAddBudget: () => void;
  openEditBudget: (b: Budget) => void;
  closeBudgetModal: () => void;

  debtModalOpen: boolean;
  editingDebt: Debt | null;
  openAddDebt: () => void;
  openEditDebt: (d: Debt) => void;
  closeDebtModal: () => void;

  assetModalOpen: boolean;
  editingAsset: Asset | null;
  openAddAsset: () => void;
  openEditAsset: (a: Asset) => void;
  closeAssetModal: () => void;

  // v7.1.3 — global Account modal (Money Map)
  accountModalOpen: boolean;
  editingAccount: Account | null;
  openAddAccount: () => void;
  openEditAccount: (a: Account) => void;
  closeAccountModal: () => void;

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
  upsertGoal: (g: Partial<Goal>) => Promise<Goal>;
  removeGoal: (id: string) => Promise<void>;
  upsertMember: (m: Partial<Member>) => Promise<Member>;
  removeMember: (id: string) => Promise<void>;
  upsertDebt: (d: Partial<Debt>) => Promise<Debt>;
  removeDebt: (id: string) => Promise<void>;
  upsertAsset: (a: Partial<Asset>) => Promise<Asset>;
  removeAsset: (id: string) => Promise<void>;
  upsertAccount: (a: Partial<Account>) => Promise<Account>;
  /** Money-Model B1.3 — reconcile an account to a real balance by writing a dated
   *  Balance Adjustment transaction (never a silent overwrite), then mark the
   *  account balance confirmed. Returns the delta booked. */
  reconcileAccount: (account: Account, realBalance: number) => Promise<number>;
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
  upsertRecurring: (s: Partial<RecurringSchedule>) => Promise<RecurringSchedule>;
  removeRecurring: (id: string) => Promise<void>;
  runRecurringEngine: () => Promise<void>;

  // v7 — notifications
  refreshNotifications: () => void;
  markNotificationRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  updateNotificationPrefs: (patch: Partial<NotificationPrefs>) => void;

  // v7 — debt payment with re-amortisation
  recordDebtPayment: (debtId: string, amount: number, choice?: PartPaymentChoice) => Promise<{ message: string; debt: Debt | null }>;

  // v4.1 — auth lifecycle
  setSession: (session: Session | null, loaded?: boolean) => void;
  refreshHouseholds: () => Promise<void>;
  subscribeRealtime: (householdId: string) => () => void;

  // theme + toast
  setTheme: (t: Theme) => void;
  toast: (text: string, type?: ToastMsg['type']) => void;
  dismissToast: (id: string) => void;
}

const defaultProfile: Profile = {
  name: '', email: '', baseCurrency: 'USD', language: 'en',
  household: 'family', dateFormat: 'us', numberSystem: 'western',
  payoffStrategy: 'avalanche', extraPayment: 0,
};

function readLocalJson<T>(suffix: string, fallback: T): T {
  try {
    const val = ls.readJson<T>(suffix);
    return val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

function readLocalString(suffix: string, fallback: string | null = null): string | null {
  try {
    const v = ls.readString(suffix);
    return v !== null ? v : fallback;
  } catch {
    return fallback;
  }
}

function setLocalJson(suffix: string, value: unknown): void {
  try { ls.setJson(suffix, value); } catch { /* noop */ }
}

function setLocalString(suffix: string, value: string): void {
  try { ls.setString(suffix, value); } catch { /* noop */ }
}

function removeLocal(suffix: string): void {
  try { ls.removeBoth(suffix); } catch { /* noop */ }
}

// v8.1.2 — monotonically increasing refresh sequence. Module-scoped (not store
// state) so bumping it never triggers a re-render. refresh() uses it to discard
// stale, out-of-order completions (see refresh()).
let refreshSeq = 0;

// Adapter selector: HybridAdapter when cloud env is set, otherwise LocalStorageAdapter.
// The store calls adapter methods; the rest of the app doesn't know which is in use.
const initialAdapter: DataAdapter = (isCloudEnabled() && supabase)
  ? new HybridAdapter(supabase)
  : new LocalStorageAdapter();

export const useStore = create<Store>((set, get) => ({
  adapter: initialAdapter,
  households: [],
  currentHouseholdId: 'local',
  transactions: [], budgets: [], goals: [], members: [], debts: [], assets: [], accounts: [],
  savedViews: [],
  profile: defaultProfile,
  rates: { ...DEFAULT_RATES },

  // v4.1
  cloudEnabled: isCloudEnabled(),
  session: null,
  sessionLoaded: !isCloudEnabled(),     // local-only mode: instantly "loaded"
  myRole: undefined,

  recurringSchedules: readLocalJson<RecurringSchedule[]>('recurring', []),
  notifications: readLocalJson<Notification[]>('notifications', []),
  notificationPrefs: { ...DEFAULT_PREFS, ...readLocalJson('notification_prefs', {}) },

  theme: (readLocalString('theme', 'warm') as Theme) || 'warm',
  loading: true,
  toasts: [],

  // v6.2.3 — global transaction modal
  txnModalOpen: false,
  editingTxn: null,
  seedTxn: null,
  openAddTxn:    (seed) => set({ editingTxn: null, seedTxn: seed ?? null, txnModalOpen: true }),
  openEditTxn:   (t) => set({ editingTxn: t, seedTxn: null, txnModalOpen: true }),
  closeTxnModal: () => set({ txnModalOpen: false, editingTxn: null, seedTxn: null }),

  // v6.4 — goal & budget modals
  goalModalOpen: false,
  editingGoal: null,
  openAddGoal:     () => set({ editingGoal: null, goalModalOpen: true }),
  openEditGoal:    (g) => set({ editingGoal: g, goalModalOpen: true }),
  closeGoalModal:  () => set({ goalModalOpen: false, editingGoal: null }),

  goalProgressModalOpen: false,
  progressGoal: null,
  openGoalProgress:  (g) => set({ progressGoal: g, goalProgressModalOpen: true }),
  closeGoalProgress: () => set({ goalProgressModalOpen: false, progressGoal: null }),

  budgetModalOpen: false,
  editingBudget: null,
  openAddBudget:    () => set({ editingBudget: null, budgetModalOpen: true }),
  openEditBudget:   (b) => set({ editingBudget: b, budgetModalOpen: true }),
  closeBudgetModal: () => set({ budgetModalOpen: false, editingBudget: null }),

  debtModalOpen: false,
  editingDebt: null,
  openAddDebt:    () => set({ editingDebt: null, debtModalOpen: true }),
  openEditDebt:   (d) => set({ editingDebt: d, debtModalOpen: true }),
  closeDebtModal: () => set({ debtModalOpen: false, editingDebt: null }),

  assetModalOpen: false,
  editingAsset: null,
  openAddAsset:    () => set({ editingAsset: null, assetModalOpen: true }),
  openEditAsset:   (a) => set({ editingAsset: a, assetModalOpen: true }),
  closeAssetModal: () => set({ assetModalOpen: false, editingAsset: null }),

  accountModalOpen: false,
  editingAccount: null,
  openAddAccount:    () => set({ editingAccount: null, accountModalOpen: true }),
  openEditAccount:   (a) => set({ editingAccount: a, accountModalOpen: true }),
  closeAccountModal: () => set({ accountModalOpen: false, editingAccount: null }),

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
    const [transactions, budgets, goals, members, debts, assets, accounts, savedViews, profile, rates] = await Promise.all([
      adapter.list<Transaction>('transactions', currentHouseholdId),
      adapter.list<Budget>('budgets',           currentHouseholdId),
      adapter.list<Goal>('goals',               currentHouseholdId),
      adapter.list<Member>('members',           currentHouseholdId),
      adapter.list<Debt>('debts',               currentHouseholdId),
      adapter.list<Asset>('assets',             currentHouseholdId),
      adapter.list<Account>('accounts',         currentHouseholdId),
      adapter.list<SavedView>('savedViews',     currentHouseholdId).catch(() => [] as SavedView[]),
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
      profile: mergedProfile,
      rates,
    });
    setNumberSystem(get().profile.numberSystem === 'indian' ? 'indian' : 'western');

    // v7.3 — Backfill RecurringSchedule rows for legacy txns whose
    // `recurring` field is set but never produced a schedule. Without this,
    // pre-v7.0 rent/salary rows are invisible to the Recurring page and the
    // Transactions calendar's projected-future-cost overlay.
    const beforeCount = get().recurringSchedules.length;
    const { schedules: nextSchedules, added } = backfillSchedulesFromTransactions(
      transactions,
      get().recurringSchedules,
    );
    if (added > 0) {
      setLocalJson('recurring', nextSchedules);
      set({ recurringSchedules: nextSchedules });
      get().toast(`Recovered ${added} recurring schedule${added === 1 ? '' : 's'} from existing transactions`, 'info');
    } else {
      void beforeCount;
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
    const { adapter, currentHouseholdId, transactions } = get();

    // Money-Model B1.1 (A2) — no transaction without an account. Default the
    // funding source to the system Cash account so the rule never blocks fast entry.
    if (!t.id) {
      if ((t.type === 'expense' || t.type === 'income' || t.type === 'transfer')
          && !t.accountId && !t.paymentMethod) {
        t = { ...t, accountId: 'cash', paymentMethod: 'cash' };
      }
    }

    // B1.5 (A2/A8 hard rule) — a transfer is STRUCTURAL: it never carries a
    // spend/earn category and never counts in spending/income totals. Enforce at
    // the data layer so no input path (Ask Vyact, import, API) can leak a
    // consumption/source category onto a transfer and cause a double-count (R1).
    if (t.type === 'transfer' && t.category !== 'transfer') {
      t = { ...t, category: 'transfer' };
    }

    // v7.0.3 — Transfer-track encoding. A transfer row carries a destination
    // account in `linkedToAssetId`; we expand it into two linked txns (one
    // expense from source, one income to dest), tagged with a __tg:<gid>
    // group marker in `note` so deletion / reporting stays consistent.
    // Reports filter `category === 'transfer'` so the pair self-cancels.
    //
    // v7.2 (Money Map) — once `money_map === 'on'` the schema has real
    // `account_id` / `to_account_id` FK columns, so a single 'transfer'
    // row is the canonical encoding. We skip the paired-row expansion in
    // that mode; `reportableTxns` filters single-row transfers via the
    // type check (it only keeps income/expense). 'shadow' keeps the
    // legacy paired write so a v7.1 client still sees the transfer.
    if (!t.id && t.type === 'transfer' && t.linkedToAssetId && t.paymentMethod
        && getMoneyMapMode() !== 'on') {
      const gid = uid();
      const baseNote = (t.note ?? '').trim();
      const tag = `__tg:${gid}`;
      const groupNote = baseNote ? `${baseNote} ${tag}` : tag;
      const out: Partial<Transaction> = {
        ...t,
        id: uid(),
        type: 'expense',
        category: 'transfer',
        paymentMethod: t.paymentMethod,
        linkedAssetId: t.paymentMethod,
        linkedToAssetId: t.linkedToAssetId,
        note: groupNote,
      };
      const inc: Partial<Transaction> = {
        ...t,
        id: uid(),
        type: 'income',
        category: 'transfer',
        paymentMethod: t.linkedToAssetId,
        linkedAssetId: t.linkedToAssetId,
        linkedToAssetId: t.paymentMethod,
        note: groupNote,
      };
      const savedOut = await adapter.upsert('transactions', currentHouseholdId, out);
      const savedInc = await adapter.upsert('transactions', currentHouseholdId, inc);
      set({ transactions: [...transactions, savedOut as Transaction, savedInc as Transaction] });
      return savedOut as Transaction;
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
    // TD-03 phase B (PR #12): thread the version precondition on edits.
    const saved = await adapter.upsert('budgets', currentHouseholdId, b, b.id && b.updated_at ? b.updated_at : undefined);
    // Period metadata now lives on the row itself (PR #20). The adapter's
    // rowToBudget mapper returns `period` / `periodStart` / `periodEnd`.
    const merged: Budget = { ...(saved as Budget), period: (saved as Budget).period || b.period || 'monthly' };
    const idx = budgets.findIndex(x => x.id === saved.id);
    set({ budgets: idx >= 0 ? budgets.map(x => x.id === saved.id ? merged : x) : [...budgets, merged] });
    return merged;
  },
  removeBudget: async (id) => {
    const { adapter, currentHouseholdId, budgets } = get();
    await adapter.remove('budgets', currentHouseholdId, id);
    set({ budgets: budgets.filter(x => x.id !== id) });
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
  reconcileAccount: async (account, realBalance) => {
    const { transactions, profile, rates } = get();
    const value = accountValueOf(account);
    const computed = computeAccountBalance(value, account.openingBalance ?? 0, transactions, profile.baseCurrency, rates);
    const { adjustment, delta } = buildReconcileAdjustment(value, computed, realBalance, account.currency || profile.baseCurrency);
    if (adjustment) await get().upsertTransaction(adjustment);   // normal account-bound txn → shows in ledger (A2)
    // Mark the balance confirmed (provenance lifecycle, R7) — never overwrite it.
    await get().upsertAccount({ ...account, confidence: 'confirmed', source: 'user', confirmedAt: new Date().toISOString() });
    return delta;
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

  // ── v7: RECURRING ────────────────────────────────────────────
  upsertRecurring: async (s) => {
    const list = get().recurringSchedules;
    const existingIdx = s.id ? list.findIndex(x => x.id === s.id) : -1;
    const isNew = existingIdx < 0;

    const next: RecurringSchedule = {
      id: s.id || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
      transactionTemplate: s.transactionTemplate!,
      frequency: s.frequency!,
      dayOfMonth: s.dayOfMonth,
      weekday: s.weekday,
      startDate: s.startDate || new Date().toISOString().split('T')[0],
      nextDueDate: s.nextDueDate || s.startDate || new Date().toISOString().split('T')[0],
      lastGenerated: s.lastGenerated,
      autoConfirm: s.autoConfirm ?? false,
      active: s.active ?? true,
      reminderLeadDays: s.reminderLeadDays,
    };

    // Seed the first transaction so a freshly-created schedule shows up in Transactions
    // immediately — unless the caller already produced one (e.g. the txn modal mirrored
    // its just-saved row into a schedule and pre-set lastGenerated).
    let seededTxn: Transaction | null = null;
    if (isNew && !next.lastGenerated && next.active && next.startDate <= today()) {
      seededTxn = {
        ...(next.transactionTemplate as Omit<Transaction, 'id' | 'date'>),
        id: uid(),
        date: next.startDate,
      } as Transaction;
      try { await get().adapter.upsert('transactions', get().currentHouseholdId, seededTxn); }
      catch { /* local fallback below still updates state */ }
      next.lastGenerated = next.startDate;
    }

    const updated = existingIdx >= 0
      ? list.map(x => x.id === next.id ? next : x)
      : [...list, next];
    setLocalJson('recurring', updated);
    set({
      recurringSchedules: updated,
      transactions: seededTxn ? [...get().transactions, seededTxn] : get().transactions,
    });
    return next;
  },

  removeRecurring: async (id) => {
    const updated = get().recurringSchedules.filter(s => s.id !== id);
    setLocalJson('recurring', updated);
    set({ recurringSchedules: updated });
  },

  runRecurringEngine: async () => {
    const { recurringSchedules, transactions } = get();
    const due = dueSchedules(recurringSchedules);
    if (!due.length) { get().refreshNotifications(); return; }
    const newTxns: Transaction[] = [];
    const updated = [...recurringSchedules];
    for (const s of due) {
      if (s.autoConfirm) {
        const txn = generateTransaction(s);
        await get().adapter.upsert('transactions', get().currentHouseholdId, txn);
        newTxns.push(txn);
      }
      const advanced = advanceSchedule(s);
      const idx = updated.findIndex(x => x.id === s.id);
      updated[idx] = advanced;
    }
    setLocalJson('recurring', updated);
    set({
      recurringSchedules: updated,
      transactions: [...transactions, ...newTxns],
    });
    get().refreshNotifications();
  },

  // ── v7: NOTIFICATIONS ────────────────────────────────────────
  refreshNotifications: () => {
    const { recurringSchedules, notifications, notificationPrefs,
            budgets, transactions, goals, profile, rates } = get();
    if (!notificationPrefs.master) return;

    const fresh: Notification[] = [
      ...upcomingBillNotifs(recurringSchedules, notificationPrefs, notifications),
      ...missedPaymentNotifs(recurringSchedules, notificationPrefs, notifications),
      ...budgetThresholdNotifs(budgets, transactions, notificationPrefs, notifications, profile.baseCurrency, rates),
      ...goalMilestoneNotifs(goals, notificationPrefs, notifications),
    ];
    if (!fresh.length) return;
    const merged = [...notifications, ...fresh];
    setLocalJson('notifications', merged);
    set({ notifications: merged });

    // Web Push for high-priority types if outside quiet hours
    if (notificationPrefs.webPushEnabled && !isInQuietHours(notificationPrefs)) {
      for (const n of fresh) {
        if (n.type === 'missed_payment' || n.type === 'goal_milestone') {
          showWebPush(n.title, n.body);
        }
      }
    }
  },

  markNotificationRead: (id) => {
    const updated = get().notifications.map(n => n.id === id ? { ...n, status: 'read' as const } : n);
    setLocalJson('notifications', updated);
    set({ notifications: updated });
  },

  dismissNotification: (id) => {
    const updated = get().notifications.map(n => n.id === id ? { ...n, status: 'dismissed' as const } : n);
    setLocalJson('notifications', updated);
    set({ notifications: updated });
  },

  updateNotificationPrefs: (patch) => {
    const next = { ...get().notificationPrefs, ...patch };
    setLocalJson('notification_prefs', next);
    set({ notificationPrefs: next });
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

  // ── v4.1: AUTH + REALTIME ───────────────────────────────────
  setSession: (session, loaded = true) => {
    const wasSignedIn = Boolean(get().session);
    const isSignedIn = Boolean(session);
    set({ session, sessionLoaded: loaded });
    if (!wasSignedIn && isSignedIn) {
      // Just signed in — load households + data
      get().init();
    } else if (wasSignedIn && !isSignedIn) {
      // v6.4: Stash the last cloud household id BEFORE clearing state, so
      // the next sign-in can land back on it (its cache is still in
      // localStorage under legacy per-household keys). Without this we'd default to the
      // first household in the list, mis-key cache lookups, and the
      // HybridAdapter "transient empty" path would kick in needlessly.
      const cur = get().currentHouseholdId;
      if (cur && cur !== 'local') {
        try { setLocalString('last_cloud_hid', cur); } catch { /* noop */ }
      }
      // Just signed out — clear in-memory cloud state
      set({
        households: [], currentHouseholdId: 'local',
        transactions: [], budgets: [], goals: [], members: [],
        debts: [], assets: [], accounts: [], savedViews: [], myRole: undefined,
      });
    }
  },

  refreshHouseholds: async () => {
    const { adapter, currentHouseholdId } = get();
    const households = await adapter.listHouseholds();
    set({ households });
    // Compute my role in the active household by reading the memberships table
    // for the current user. The membership.role column carries the AppRole.
    if (supabase && get().session?.user) {
      try {
        const { data } = await supabase.from('memberships')
          .select('role')
          .eq('household_id', currentHouseholdId)
          .eq('user_id', get().session!.user.id)
          .maybeSingle();
        set({ myRole: (data?.role as AppRole) || undefined });
      } catch { /* offline — keep last known */ }
    } else {
      set({ myRole: 'owner' });   // local-only: you own everything
    }
    void highestRole; // suppress unused
  },

  subscribeRealtime: (householdId) => {
    if (!supabase) return () => {/* noop */};
    // v8.1.2 — debounce: a single user action (e.g. a transfer's paired rows, or
    // a quick succession of adds) emits a burst of postgres_changes events. Firing
    // a full refresh() per event spawned overlapping reads that resolved out of
    // order and clobbered just-written rows (dashboard totals froze). Collapse the
    // burst into one trailing refresh after the writes settle.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`hh:${householdId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', filter: `household_id=eq.${householdId}` },
          () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => { debounce = null; void get().refresh(); }, 400);
          })
      .subscribe();
    return () => { if (debounce) clearTimeout(debounce); supabase!.removeChannel(channel); };
  },

  setTheme: (theme) => {
    setLocalString('theme', theme);
    set({ theme });
    const root = document.documentElement;
    if (theme === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', dark);
      root.dataset.theme = dark ? 'dark' : 'warm';
    } else {
      root.classList.toggle('dark', theme === 'dark');
      root.dataset.theme = theme;
    }
  },

  toast: (text, type = 'success') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    set(s => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

// Expose store to E2E tests in non-production modes (read-only access).
if (import.meta.env.MODE !== 'production') {
  // Expose the Zustand hook so Playwright tests can inspect derived state.
  // Use the localStorageCompat helper to avoid embedding legacy/global
  // names as string literals in the build output.
  try {
    const legacyName = '__' + ls.legacyKey('store');
    const newName = '__' + ls.newKey('store');
    (window as any)[legacyName] = useStore;
    (window as any)[newName] = useStore;
  } catch {
    // best-effort exposure only
    (window as any).__vt_store = useStore;
  }
}
