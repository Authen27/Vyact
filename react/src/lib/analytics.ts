// Vyact analytics — typed wrapper over the gtag.js snippet in index.html.
//
// Usage:
//   import { track } from './analytics';
//   track('txn_saved', { track: 'expense', currency: 'USD', amount_bucket: '10-100' });
//
// Rules:
// - NEVER pass PII (no descriptions, names, emails, raw amounts).
// - Numeric amounts are bucketed via `bucketAmount()` before send.
// - Event names use snake_case and live in `EventName` below — adding a name
//   without updating docs/MEASUREMENT_PLAN.md is a review-block.

type GtagFn = (
  command: 'event' | 'config' | 'set',
  target: string,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
    __vt_store?: unknown;
  }
}

export type EventName =
  // Transaction track-picker (Item #1 / Item #9)
  | 'txn_modal_opened'
  | 'txn_track_chosen'
  | 'txn_saved'
  | 'txn_abandoned'
  | 'txn_edited'
  | 'txn_deleted'
  // Calculator (Item #6)
  | 'calc_expression_used'
  // Filters (Item #4)
  | 'filter_applied'
  | 'saved_view_created'
  // Reports / insights (Item #8)
  | 'report_period_changed'
  | 'report_drilldown_clicked'
  | 'insight_dismissed'
  | 'insight_actioned'
  // Onboarding & education (Item #7)
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_skipped'
  | 'onboarding_completed'
  | 'onboarding_nudge_shown'
  | 'onboarding_nudge_dismissed'
  | 'estimate_confirmed'
  | 'confirmed_pct_milestone'
  | 'bank_connect_offered'
  | 'help_tooltip_opened'
  // Cross-cutting
  | 'feature_flag_exposure'
  | 'app_error_boundary'
  // v10.49.0 (marketing #5) — the funnel from visit to active household. GA4 marks
  // sign_up, first_transaction_logged and member_invited as key events (#6).
  | 'sign_up'
  | 'household_created'
  | 'first_transaction_logged'
  | 'member_invited'
  | 'budget_created'
  | 'learn_card_view'
  | 'learn_cta_click'
  | 'pwa_install'
  | 'whatsapp_linked';

export type AmountBucket = '0-10' | '10-100' | '100-1k' | '1k-10k' | '10k+';
export type TxnTrack = 'expense' | 'income' | 'transfer' | 'investment';

export interface EventParams {
  track?: TxnTrack;
  amount_bucket?: AmountBucket;
  currency?: string;
  category_id?: string;
  category_kind?: 'expense' | 'income' | 'investment' | 'transfer';
  account_type?: 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment' | 'other';
  duration_ms?: number;
  surface?: string;
  mode?: 'add' | 'edit';
  via?: 'click' | 'keyboard';
  reason?: string;
  page?: string;
  facets?: number;
  had_query?: boolean;
  has_member?: boolean;
  has_payment_method?: boolean;
  fields_changed?: number;
  operators?: number;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  chart?: string;
  insight_kind?: string;
  action?: string;
  step?: string;
  step_index?: number;
  topic?: string;
  flag?: string;
  variant?: 'on' | 'off' | 'control';
  route?: string;
  count?: number;
  // Onboarding (spec §7)
  segment?: 'individual' | 'household' | 'smb' | 'none';
  flag_enabled?: boolean;
  total_ms?: number;
  baseline_count?: number;
  confirmed_pct?: number;
  nudge_kind?: 'check_in' | 'confirm_estimate' | 'bank_connect';
  days_since?: number;
  log_count?: number;
  via_nudge?: boolean;
  record_type?: string;
  milestone?: number;
  // Funnel (v10.49.0)
  method?: string;          // sign_up: 'email' | 'google'
  ref?: string;             // where a sign-up came from (?ref= on landing / Learn links)
  placement?: string;       // which call to action
  slug?: string;            // a PUBLIC Learn lesson's slug, never user data
  learn_category?: string;  // a public Learn topic
  invite_role?: 'admin' | 'member' | 'viewer' | 'child';
  platform?: 'android-app' | 'pwa' | 'web';
}

/** Where the person is using Vyact from; sent with every event (#5). */
export function platform(): 'android-app' | 'pwa' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return 'android-app';
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return 'pwa';
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return 'pwa';
  } catch { /* fall through */ }
  return 'web';
}

const isEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Disable for Playwright runs (the e2e oracle is mounted) and Vitest.
  if (window.__vt_store !== undefined) return false;
  if (import.meta.env.MODE === 'test') return false;
  return typeof window.gtag === 'function';
};

export function track(name: EventName, params: EventParams = {}): void {
  if (!isEnabled()) return;
  try {
    window.gtag?.('event', name, { ...params, platform: params.platform ?? platform() } as Record<string, unknown>);
  } catch {
    // Analytics must never break the app.
  }
}

/** Identify the active session without leaking household id. */
export function setUserProperties(props: {
  household_size?: number;
  base_currency?: string;
  cloud_enabled?: boolean;
  theme?: 'warm' | 'dark' | 'system';
  app_version?: string;
}): void {
  if (!isEnabled()) return;
  try {
    window.gtag?.('set', 'user_properties', props);
  } catch { /* no-op */ }
}

/** Bucket a money amount before sending — never send raw values. */
export function bucketAmount(amount: number): AmountBucket {
  const a = Math.abs(amount);
  if (a < 10) return '0-10';
  if (a < 100) return '10-100';
  if (a < 1000) return '100-1k';
  if (a < 10000) return '1k-10k';
  return '10k+';
}

/** Fire a feature_flag_exposure once per session per flag. */
const exposed = new Set<string>();
export function trackFlagExposure(flag: string, variant: 'on' | 'off' | 'control'): void {
  const key = `${flag}:${variant}`;
  if (exposed.has(key)) return;
  exposed.add(key);
  track('feature_flag_exposure', { flag, variant });
}

const REF_KEY = 'vy_signup_ref';

/** Keep the landing / Learn `?ref=` through the auth flow, so sign_up can say where it came from. */
export function rememberSignupRef(ref: string | null): void {
  if (!ref) return;
  try { localStorage.setItem(REF_KEY, ref.slice(0, 80)); } catch { /* private mode */ }
}

/**
 * sign_up fires once, on the FIRST sign-in of a new account (email after verifying, or
 * Google): created_at and last_sign_in_at within a minute of each other. A per-user flag
 * stops a reload of that first session counting twice.
 */
export function trackSignUpOnce(user: { id: string; created_at?: string; last_sign_in_at?: string; app_metadata?: { provider?: string } }): void {
  try {
    if (!user.created_at || !user.last_sign_in_at) return;
    if (Math.abs(Date.parse(user.last_sign_in_at) - Date.parse(user.created_at)) > 60_000) return;
    const flag = `vy_signup_tracked_${user.id}`;
    if (localStorage.getItem(flag)) return;
    localStorage.setItem(flag, '1');
    const ref = localStorage.getItem(REF_KEY) ?? undefined;
    localStorage.removeItem(REF_KEY);
    track('sign_up', { method: user.app_metadata?.provider ?? 'email', ref });
  } catch { /* never block sign-in */ }
}
