// Vyact v6 — Type definitions
// All data models in one place. Imported throughout the app.
//
// ── Money fields (TD-01 discipline) ─────────────────────────────
//
// Every `amount`, `limit`, `value`, `currentBalance`, `principal`,
// `minimumPayment`, `target`, `current`, `yourShare`, `share`,
// `extraPayment`, `monthly_amount`, etc. is a JS `number` in **major
// units** (dollars, euros, yen). They are always paired with an explicit
// `currency` field on the same entity (or carry the household's
// `baseCurrency` when not specified). The current/published versions
// reflect the TD-01 rollout (PR #8–#10):
//
//   • At the FX boundary  (`lib/format.ts:convert`) — exact via dinero.js
//     with banker's rounding at the target currency's native exponent.
//   • Aggregations / sums (`lib/calculations.ts`) — folded in dinero space
//     via `sumDinero` so reductions don't drift across many transactions.
//   • Amortisation / EMI (`lib/amortization.ts`) — outstanding-balance
//     chains and interest splits run through dinero in the debt's native
//     currency so a 300-row schedule doesn't accumulate per-step drift.
//   • Cloud boundary (`lib/supabaseAdapter.ts` row mappers) — every
//     money column goes through `lib/money.ts:parseMoneyFromCloud`,
//     which handles Supabase's `numeric(15,2)` string serialisation
//     defensively.
//
// A future PR may introduce a `Money` opaque type (a `number` brand) to
// move these guarantees from runtime convention into the compiler. Until
// then, the convention above is what the math layer relies on — if you
// add a new money field, route it through the same primitives.

export type TxnType = 'income' | 'expense' | 'investment' | 'transfer';
export type Recurrence = '' | 'weekly' | 'monthly' | 'yearly';
export type Theme = 'warm' | 'dark' | 'system';
export type PayoffStrategy = 'avalanche' | 'snowball';
export type Liquidity = 'liquid' | 'short' | 'long';
export type MemberRole = 'primary' | 'partner' | 'child' | 'elder';
export type AppRole = 'owner' | 'admin' | 'member' | 'viewer' | 'child';
export type GoalType = 'emergency' | 'savings' | 'debt' | 'investment' | 'purchase' | 'custom';
export type ProfileTypeKey = 'personal' | 'family' | 'business' | 'multi_biz' | 'shared';

export interface SplitParticipant {
  name: string;        // 'me' for self, otherwise free text
  isYou?: boolean;
  share: number;
  paid: boolean;
  paidOn?: string | null;
}

export interface SplitInfo {
  isSplit: true;
  totalAmount: number;
  yourShare: number;
  paidBy: 'me' | 'external';
  participants: SplitParticipant[];
}

// v8 — Onboarding & Activation provenance (spec §3.2). Carried on every
// baseline-derived record so honest-data rendering and the 21-day truing-up loop
// work across devices (these are real, cloud-synced columns, not a local overlay).
export type Confidence = 'estimated' | 'confirming' | 'confirmed';
export type ProvenanceSource = 'onboarding' | 'user' | 'bank';

/** Mixed onto baseline-derived entities (Transaction, Budget, Goal, Debt, Asset).
 *  Absent / 'confirmed' + 'user' means a first-class, user-owned value. */
export interface WithProvenance {
  /** Defaults to 'confirmed' for normal user/legacy rows. */
  confidence?: Confidence;
  /** Defaults to 'user'. 'onboarding' marks a setup estimate. */
  source?: ProvenanceSource;
  /** When the estimate was captured / when it became confirmed. */
  estimatedAt?: string;
  confirmedAt?: string;
}

export interface Transaction extends WithProvenance {
  id: string;
  type: TxnType;
  amount: number;
  currency: string;
  date: string;            // YYYY-MM-DD
  time?: string;           // HH:MM local time
  description: string;
  category: string;
  note?: string;
  memberId?: string;
  recurring?: Recurrence;
  paymentMethod?: string;
  excluded?: boolean;
  linkedAssetId?: string;
  linkedToAssetId?: string;
  linkedDebtId?: string;
  linkedTxnId?: string;
  /** v7.1 Money Map — FK to `accounts.id`. Dual-written alongside
   *  `linkedAssetId` while flag is `'shadow'`; sole source once `'on'`. */
  accountId?: string;
  toAccountId?: string;
  initiatedBy?: string;
  /** v7.3 — Money Map Item #5 (multi-account split). When set, the txn's
   *  total amount is divided across these accounts (e.g. partial debit +
   *  partial credit-card). Sum of `amount` must equal `Transaction.amount`.
   *  When unset, the single `accountId` is the source of funds. Persisted
   *  on the transaction directly; v7.4 may move this to its own table. */
  accountSplits?: AccountSplit[];
  split?: SplitInfo;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AccountSplit {
  accountId: string;
  amount: number;
}

export type BudgetPeriod = 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'custom';

export interface Budget extends WithProvenance {
  id: string;
  category: string;
  /** Budgeted amount for the entire `period` window (NOT per month).
   *  When `period === 'monthly'` this matches the legacy meaning. */
  limit: number;
  currency: string;
  color?: string;
  /** v6.4 — budgeting period. Defaults to 'monthly' for legacy rows. */
  period?: BudgetPeriod;
  /** v6.4 — only used when `period === 'custom'`. ISO YYYY-MM-DD. */
  periodStart?: string;
  periodEnd?: string;
  /** v6.4.19 — TD-03 optimistic-concurrency precondition. Mirrors the cloud row's
   *  updated_at; threaded back to the adapter on edits so a concurrent
   *  edit by another household member surfaces as a conflict instead of
   *  silently overwriting. Undefined for never-synced local rows. */
  updated_at?: string;
}

export interface Goal extends WithProvenance {
  id: string;
  type: GoalType;
  name: string;
  target: number;
  current: number;
  currency: string;
  deadline?: string;
  completed: boolean;
  /** v6.4.19 — TD-03 optimistic-concurrency precondition. See Budget.updated_at. */
  updated_at?: string;
}

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  appRole?: AppRole;
  userId?: string;
}

export interface Debt extends WithProvenance {
  id: string;
  type: string;
  name: string;
  lender?: string;
  account?: string;
  principal: number;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  tenureMonths?: number;
  remainingMonths?: number; // v7 — re-amortised after part-payments
  dueDate?: string;
  currency: string;
  paymentLog?: PaymentLogEntry[];
  /** v7.1 Money Map — bidirectional debt support. `'owed_by_me'` is a
   *  liability (the legacy meaning); `'owed_to_me'` is a receivable shown
   *  separately on Net Worth. Defaults to `'owed_by_me'` for legacy rows. */
  direction?: 'owed_by_me' | 'owed_to_me';
  counterpartyName?: string;
  /** v6.4.19 — TD-03 optimistic-concurrency precondition. See Budget.updated_at. */
  updated_at?: string;
}

export interface Asset extends WithProvenance {
  id: string;
  type: string;
  name: string;
  value: number;
  currency: string;
  liquidity: Liquidity;
  note?: string;
  lastUpdated?: string;
  /** v6.4.19 — TD-03 optimistic-concurrency precondition. See Budget.updated_at. */
  updated_at?: string;
}

// ─── v7.1 Money Map — first-class accounts + saved views ──────────────────

export type AccountKind =
  | 'checking' | 'savings' | 'credit_card' | 'cash'
  | 'investment' | 'wallet' | 'other';

export interface Account {
  id: string;
  /** Legacy back-link to the asset this account was synthesised from. Set
   *  by the Phase 1 backfill; null for accounts the user creates directly. */
  assetId?: string;
  kind: AccountKind;
  name: string;
  currency: string;
  isDefault?: boolean;
  isArchived?: boolean;
  updated_at?: string;
}

export type SavedViewPage = 'transactions' | 'reports' | 'insights';

export interface SavedView {
  id: string;
  userId: string;
  page: SavedViewPage;
  name: string;
  /** Sanitised filter parameters only. NEVER store transaction ids, member
   *  ids, or descriptions here — Sec-2 in SOLUTION_MONEY_MAP.md. */
  filters: Record<string, unknown>;
  isShared?: boolean;
  updated_at?: string;
}

export type TemplateKey =
  | 'young_couple' | 'family' | 'single' | 'self_employed' | 'retiree' | 'student';

export interface Profile {
  name: string;
  email: string;
  baseCurrency: string;
  language: string;
  household: ProfileTypeKey;
  dateFormat: 'us' | 'eu' | 'iso';
  /** v7.4.0 — large-number compaction system. 'western' uses K/M/B/T,
   *  'indian' uses K/L/Cr (lakh = 100K, crore = 10M). Defaults to 'western'. */
  numberSystem?: 'western' | 'indian';
  payoffStrategy: PayoffStrategy;
  extraPayment: number;
  // v7
  template?: TemplateKey;
  primaryConcern?: 'spending' | 'debt' | 'savings' | 'retirement';
  onboardedAt?: string;
  /** v7.3 — Money Map Migration B. Cloud-persisted education/onboarding
   *  progress: completed-at / dismissed-at per topic id. App caps at 50
   *  keys (Risk S-3) before pruning oldest by completed_at. */
  educationProgress?: EducationProgress;
}

/** Per-topic education state. Topic ids are app-defined strings such as
 *  `tour_v1`, `pulse_score`, `debt_strategy`. */
export interface EducationTopicState {
  completed_at?: string;
  dismissed_at?: string;
}
export type EducationProgress = Record<string, EducationTopicState>;

// v7 — Recurring schedules
export type RecurrenceFreq = 'weekly' | 'monthly' | 'yearly' | 'custom_day';

export interface RecurringSchedule {
  id: string;
  transactionTemplate: Omit<Transaction, 'id' | 'date'>;
  frequency: RecurrenceFreq;
  dayOfMonth?: number;       // for monthly + custom_day
  weekday?: number;          // 0-6 for weekly
  startDate: string;         // YYYY-MM-DD
  nextDueDate: string;
  lastGenerated?: string;
  autoConfirm: boolean;
  active: boolean;
  reminderLeadDays?: number; // 0-7 — fires upcoming-bill notif this many days before
}

// v7 — Notifications
export type NotifType =
  | 'upcoming_bill' | 'missed_payment' | 'budget_threshold'
  | 'goal_milestone' | 'weekly_digest' | 'custom_reminder';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  createdAt: string;
  dueAt?: string;
  status: 'unread' | 'read' | 'dismissed';
  scheduleId?: string;
  goalId?: string;
  budgetId?: string;
  custom?: { recur?: RecurrenceFreq };
}

export interface NotificationPrefs {
  master: boolean;
  upcoming_bill: boolean;
  missed_payment: boolean;
  budget_threshold: boolean;
  goal_milestone: boolean;
  weekly_digest: boolean;
  custom_reminder: boolean;
  quietStart: string;  // HH:MM
  quietEnd: string;    // HH:MM
  webPushEnabled: boolean;
  defaultLeadDays: 1 | 3 | 7;
}

// v7 — Amortisation schedule entry
export interface AmortizationEntry {
  month: number;
  date: string;
  emi: number;
  interest: number;
  principal: number;
  outstanding: number;
}

export type PartPaymentChoice = 'reduce_tenure' | 'reduce_emi' | 'apply_advance';

export interface PaymentLogEntry {
  id: string;
  date: string;
  amount: number;
  interest: number;
  principal: number;
  outstandingAfter: number;
  isPartPayment: boolean;
  partChoice?: PartPaymentChoice;
}

export interface HouseholdMeta {
  id: string;
  name: string;
  type: ProfileTypeKey;
  baseCurrency: string;
  createdAt: string;
  /** v8 — per-household onboarding state machine record, cloud-persisted on the
   *  `households.onboarding` jsonb column. Shape defined in lib/onboardingState.
   *  Untyped here (Record) to avoid a types→lib import cycle; the lib casts it. */
  onboarding?: Record<string, unknown>;
}

export interface ExchangeRates {
  [currencyCode: string]: number;
}

export interface BackupV6 {
  /** Semver string of the consumer app that produced this backup, e.g. "6.3.1". */
  version: string;
  exported: string;
  profile: Profile;
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  members: Member[];
  debts: Debt[];
  assets: Asset[];
  exchangeRates: ExchangeRates;
}
