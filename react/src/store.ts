// FinFlow v6 — Zustand global store
// All state + every CRUD action goes through here.
// CRUD actions persist via DataAdapter, then update in-memory state.

import { create } from 'zustand';
import type {
  Transaction, Budget, Goal, Member, Debt, Asset,
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
import { hydrateBudgets, setBudgetMeta, deleteBudgetMeta } from './lib/budgetMeta';
import {
  dueSchedules, generateTransaction, advanceSchedule,
} from './lib/recurring';
import {
  upcomingBillNotifs, missedPaymentNotifs, budgetThresholdNotifs,
  goalMilestoneNotifs, DEFAULT_PREFS, isInQuietHours, showWebPush,
} from './lib/notifications';

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
  openAddTxn: () => void;
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

  updateProfile: (patch: Partial<Profile>) => Promise<void>;
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
  household: 'family', dateFormat: 'us',
  payoffStrategy: 'avalanche', extraPayment: 0,
};

// Adapter selector: HybridAdapter when cloud env is set, otherwise LocalStorageAdapter.
// The store calls adapter methods; the rest of the app doesn't know which is in use.
const initialAdapter: DataAdapter = (isCloudEnabled() && supabase)
  ? new HybridAdapter(supabase)
  : new LocalStorageAdapter();

export const useStore = create<Store>((set, get) => ({
  adapter: initialAdapter,
  households: [],
  currentHouseholdId: 'local',
  transactions: [], budgets: [], goals: [], members: [], debts: [], assets: [],
  profile: defaultProfile,
  rates: { ...DEFAULT_RATES },

  // v4.1
  cloudEnabled: isCloudEnabled(),
  session: null,
  sessionLoaded: !isCloudEnabled(),     // local-only mode: instantly "loaded"
  myRole: undefined,

  recurringSchedules: JSON.parse(localStorage.getItem('ff_recurring') || '[]'),
  notifications: JSON.parse(localStorage.getItem('ff_notifications') || '[]'),
  notificationPrefs: { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('ff_notification_prefs') || '{}') },

  theme: (localStorage.getItem('ff_theme') as Theme) || 'warm',
  loading: true,
  toasts: [],

  // v6.2.3 — global transaction modal
  txnModalOpen: false,
  editingTxn: null,
  openAddTxn:    () => set({ editingTxn: null, txnModalOpen: true }),
  openEditTxn:   (t) => set({ editingTxn: t, txnModalOpen: true }),
  closeTxnModal: () => set({ txnModalOpen: false, editingTxn: null }),

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
    // ff_last_cloud_hid is set on sign-out so a fresh sign-in lands on the
    // same household whose cache (ff_<hid>_*) we still hold locally.
    const lastCloudHid = (cloudEnabled && typeof localStorage !== 'undefined')
      ? localStorage.getItem('ff_last_cloud_hid')
      : null;
    const preferredId = lastCloudHid && households.some(h => h.id === lastCloudHid)
      ? lastCloudHid
      : activeHouseholdId;
    const active = households.length
      ? (households.find(h => h.id === preferredId)?.id || households[0].id)
      : 'local';
    set({ households, currentHouseholdId: active });
    if (cloudEnabled && active !== 'local') {
      try { localStorage.setItem('ff_last_cloud_hid', active); } catch { /* noop */ }
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
        if (typeof console !== 'undefined') console.warn('[FinFlow] auto-migration failed', e);
      }
    }
    // v7: run recurring + refresh notifications on every load
    await get().runRecurringEngine();
    get().refreshNotifications();

    set({ loading: false });
  },

  refresh: async () => {
    const { adapter, currentHouseholdId } = get();
    const [transactions, budgets, goals, members, debts, assets, profile, rates] = await Promise.all([
      adapter.list<Transaction>('transactions', currentHouseholdId),
      adapter.list<Budget>('budgets',           currentHouseholdId),
      adapter.list<Goal>('goals',               currentHouseholdId),
      adapter.list<Member>('members',           currentHouseholdId),
      adapter.list<Debt>('debts',               currentHouseholdId),
      adapter.list<Asset>('assets',             currentHouseholdId),
      adapter.getProfile(currentHouseholdId),
      adapter.getRates(currentHouseholdId),
    ]);
    // v6.4: hydrate per-budget local period metadata (DB schema lacks an
    // extras column on budgets so period info is a client-side overlay).
    const hydratedBudgets = hydrateBudgets(budgets);
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
      set({
        profile: profile ? { ...defaultProfile, ...profile } : prev.profile,
        rates: rates && Object.keys(rates).length ? rates : prev.rates,
      });
      prev.toast('Cloud sync looked empty — keeping local data. Use Force Resync if needed.', 'warning');
      return;
    }
    set({
      transactions, budgets: hydratedBudgets, goals, members, debts, assets,
      profile: profile ? { ...defaultProfile, ...profile } : defaultProfile,
      rates,
    });
  },

  switchHousehold: async (id) => {
    const { adapter, cloudEnabled } = get();
    await adapter.setActiveHousehold(id);
    set({ currentHouseholdId: id });
    if (cloudEnabled && id !== 'local') {
      try { localStorage.setItem('ff_last_cloud_hid', id); } catch { /* noop */ }
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
    await adapter.remove('transactions', currentHouseholdId, id);
    set({ transactions: transactions.filter(x => x.id !== id) });
  },
  upsertBudget: async (b) => {
    const { adapter, currentHouseholdId, budgets } = get();
    // TD-03 phase B (PR #12): thread the version precondition on edits.
    const saved = await adapter.upsert('budgets', currentHouseholdId, b, b.id && b.updated_at ? b.updated_at : undefined);
    // v6.4: persist period metadata locally (cloud schema lacks an extras
    // column on budgets; this is a non-destructive client-side overlay).
    if (b.period || b.periodStart || b.periodEnd) {
      setBudgetMeta(saved.id, {
        period: b.period,
        periodStart: b.periodStart,
        periodEnd: b.periodEnd,
      });
    }
    const merged: Budget = { ...(saved as Budget), period: b.period || (saved as Budget).period || 'monthly',
      periodStart: b.periodStart, periodEnd: b.periodEnd };
    const idx = budgets.findIndex(x => x.id === saved.id);
    set({ budgets: idx >= 0 ? budgets.map(x => x.id === saved.id ? merged : x) : [...budgets, merged] });
    return merged;
  },
  removeBudget: async (id) => {
    const { adapter, currentHouseholdId, budgets } = get();
    await adapter.remove('budgets', currentHouseholdId, id);
    deleteBudgetMeta(id);
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

  updateProfile: async (patch) => {
    const { adapter, currentHouseholdId, profile } = get();
    const next = await adapter.updateProfile(currentHouseholdId, patch);
    set({ profile: { ...profile, ...next } });
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
    const idx = list.findIndex(x => x.id === next.id);
    const updated = idx >= 0 ? list.map(x => x.id === next.id ? next : x) : [...list, next];
    localStorage.setItem('ff_recurring', JSON.stringify(updated));
    set({ recurringSchedules: updated });
    return next;
  },

  removeRecurring: async (id) => {
    const updated = get().recurringSchedules.filter(s => s.id !== id);
    localStorage.setItem('ff_recurring', JSON.stringify(updated));
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
    localStorage.setItem('ff_recurring', JSON.stringify(updated));
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
    localStorage.setItem('ff_notifications', JSON.stringify(merged));
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
    localStorage.setItem('ff_notifications', JSON.stringify(updated));
    set({ notifications: updated });
  },

  dismissNotification: (id) => {
    const updated = get().notifications.map(n => n.id === id ? { ...n, status: 'dismissed' as const } : n);
    localStorage.setItem('ff_notifications', JSON.stringify(updated));
    set({ notifications: updated });
  },

  updateNotificationPrefs: (patch) => {
    const next = { ...get().notificationPrefs, ...patch };
    localStorage.setItem('ff_notification_prefs', JSON.stringify(next));
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
      // localStorage under ff_<hid>_*). Without this we'd default to the
      // first household in the list, mis-key cache lookups, and the
      // HybridAdapter "transient empty" path would kick in needlessly.
      const cur = get().currentHouseholdId;
      if (cur && cur !== 'local') {
        try { localStorage.setItem('ff_last_cloud_hid', cur); } catch { /* noop */ }
      }
      // Just signed out — clear in-memory cloud state
      set({
        households: [], currentHouseholdId: 'local',
        transactions: [], budgets: [], goals: [], members: [],
        debts: [], assets: [], myRole: undefined,
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
    const channel = supabase
      .channel(`hh:${householdId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', filter: `household_id=eq.${householdId}` },
          () => { get().refresh(); })
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  },

  setTheme: (theme) => {
    localStorage.setItem('ff_theme', theme);
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
  (window as any).__ff_store = useStore;
}
