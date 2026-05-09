// FinFlow v6 — Type definitions
// All data models in one place. Imported throughout the app.

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

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  currency: string;
  date: string;            // YYYY-MM-DD
  description: string;
  category: string;
  note?: string;
  memberId?: string;
  recurring?: Recurrence;
  paymentMethod?: string;
  excluded?: boolean;
  linkedAssetId?: string;
  linkedDebtId?: string;
  linkedTxnId?: string;
  split?: SplitInfo;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  currency: string;
  color?: string;
}

export interface Goal {
  id: string;
  type: GoalType;
  name: string;
  target: number;
  current: number;
  currency: string;
  deadline?: string;
  completed: boolean;
}

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  appRole?: AppRole;
}

export interface Debt {
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
}

export interface Asset {
  id: string;
  type: string;
  name: string;
  value: number;
  currency: string;
  liquidity: Liquidity;
  note?: string;
  lastUpdated?: string;
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
  payoffStrategy: PayoffStrategy;
  extraPayment: number;
  // v7
  template?: TemplateKey;
  primaryConcern?: 'spending' | 'debt' | 'savings' | 'retirement';
  onboardedAt?: string;
}

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
}

export interface ExchangeRates {
  [currencyCode: string]: number;
}

export interface BackupV6 {
  version: '6.0';
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
