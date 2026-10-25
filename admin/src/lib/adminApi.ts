// Vyact Admin v8 — Data fetchers (live Supabase)
// Every page reads from this module. Mock data is gone.

import { sb } from './supabase';
import { normalizeHouseholdType, type HouseholdType } from './householdTypes';
import type { AdminRole } from '../types';

// ── Dashboard KPIs ──────────────────────────────────────────────────
export interface DashboardKpis {
  totalUsers: number;
  totalHouseholds: number;
  multiMemberPct: number;
  activeUsers7d: number;
  activeHouseholds7d: number;
  signups7d: number;
  signups30d: number;
  totalTransactions: number;
  transactions7d: number;
  publishedArticles: number;
  contentFavorites: number;
  paidSubscriptions: number;
  /** ADM-14 (v1.5.0): monthly revenue of active and trialing subscriptions, per currency; never summed. */
  mrrByCurrency: Record<string, number>;
  computedAt: string;
}

export async function fetchDashboardKpis(): Promise<DashboardKpis> {
  const { data, error } = await sb().rpc('admin_dashboard_kpis');
  if (error) throw error;
  return data as DashboardKpis;
}

// ── Weekly trend (signups / active / txns) ──────────────────────────
export interface WeeklyTrendRow {
  week_start: string;
  signups: number;
  active_users: number;
  new_txns: number;
}
export async function fetchWeeklyTrend(weeks = 12): Promise<WeeklyTrendRow[]> {
  const { data, error } = await sb().rpc('admin_weekly_trend', { weeks });
  if (error) throw error;
  return (data as WeeklyTrendRow[]) || [];
}

// ── AI usage / intelligence ─────────────────────────────────────────
export interface AiUsageSegment {
  userId: string;
  email: string | null;
  interactions: number;
  topIntent: string | null;
  avgSentiment: number | null;
  lastSeen: string | null;
}
export interface AiUsageSummary {
  total: number;
  users: number;
  last7: number;
  last30: number;
  byIntent: Record<string, number>;
  bySentiment: Record<string, number>;
  segments: AiUsageSegment[];
}
export async function fetchAiUsageSummary(): Promise<AiUsageSummary> {
  const { data, error } = await sb().rpc('admin_ai_usage_summary');
  if (error) throw error;
  const d = (data || {}) as Partial<AiUsageSummary>;
  return {
    total: d.total ?? 0,
    users: d.users ?? 0,
    last7: d.last7 ?? 0,
    last30: d.last30 ?? 0,
    byIntent: d.byIntent ?? {},
    bySentiment: d.bySentiment ?? {},
    segments: d.segments ?? [],
  };
}

// ── Pip answer feedback (v1.4.2) ────────────────────────────────────
// The 👍 / 👎 members give Pip's answers (consumer v10.54.0, table ai_feedback).
// Rating, classified intent, answer length and surface only — never the question
// or the answer.
export interface AiFeedbackIntentRow { intent: string; up: number; down: number; }
export interface AiFeedbackRecentRow {
  at: string; rating: 1 | -1; intent: string | null; surface: string; responseLen: number | null;
}
export interface AiFeedbackSummary {
  total: number;
  up: number;
  down: number;
  last30: number;
  byIntent: AiFeedbackIntentRow[];
  recent: AiFeedbackRecentRow[];
}
export async function fetchAiFeedbackSummary(): Promise<AiFeedbackSummary> {
  const { data, error } = await sb().rpc('admin_ai_feedback_summary');
  if (error) throw error;
  const d = (data || {}) as Partial<AiFeedbackSummary>;
  return {
    total: d.total ?? 0,
    up: d.up ?? 0,
    down: d.down ?? 0,
    last30: d.last30 ?? 0,
    byIntent: d.byIntent ?? [],
    recent: d.recent ?? [],
  };
}

// ── Users ───────────────────────────────────────────────────────────
export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  household_count: number;
  is_admin: boolean;
  admin_role: AdminRole | null;
}

/** One page of people, newest first, and how many matched (ADM-08, v1.5.0: the list stopped at 1,000 rows). */
export interface Page<T> { rows: T[]; total: number }
export const PAGE_SIZE = 100;

export async function fetchUsersPage(offset = 0, query = '', limit = PAGE_SIZE): Promise<Page<AdminUserRow>> {
  const { data, error } = await sb().rpc('admin_list_users_page', { p_limit: limit, p_offset: offset, p_query: query.trim() || null });
  if (error) throw error;
  const rows = (data as (AdminUserRow & { total: number })[]) || [];
  return { rows: rows.map(({ total: _total, ...r }) => r), total: rows.length ? Number(rows[0].total) : 0 };
}

/** The Users and Households pages' headline counts, counted on the server (they were counted from the list). */
export interface PeopleSummary {
  users: { total: number; confirmed: number; admins: number; multiHousehold: number };
  households: { total: number; multiMember: number; byType: Partial<Record<string, number>> };
}
export async function fetchPeopleSummary(): Promise<PeopleSummary> {
  const { data, error } = await sb().rpc('admin_people_summary');
  if (error) throw error;
  return data as PeopleSummary;
}

/** ADM-04 (v1.5.0): staff roles change only through these (super admins; the last super admin is kept). */
export async function grantAdminRole(userId: string, role: AdminRole): Promise<void> {
  const { error } = await sb().rpc('grant_admin_role', { p_user: userId, p_role: role });
  if (error) throw error;
}
export async function revokeAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await sb().rpc('revoke_admin_role', { p_user: userId });
  if (error) throw error;
  return data === true;
}

// ── Households ─────────────────────────────────────────────────────
export interface AdminHouseholdRow {
  id: string;
  name: string;
  type: HouseholdType;   // W8c (INT-CON-06): today's four, normalised
  base_currency: string;
  created_by: string;
  created_at: string;
  member_count: number;
}

/** One page of households with their member counts, counted on the server (INT-HH-14, v1.5.0). */
export async function fetchHouseholdsPage(offset = 0, query = '', limit = PAGE_SIZE): Promise<Page<AdminHouseholdRow>> {
  const { data, error } = await sb().rpc('admin_list_households', { p_limit: limit, p_offset: offset, p_query: query.trim() || null });
  if (error) throw error;
  const rows = (data as (AdminHouseholdRow & { total: number })[]) || [];
  return {
    rows: rows.map(({ total: _total, ...h }) => ({
      ...h,
      type: normalizeHouseholdType((h as { type?: unknown }).type),
      member_count: Number(h.member_count) || 0,
    })),
    total: rows.length ? Number(rows[0].total) : 0,
  };
}

// ── Subscriptions ──────────────────────────────────────────────────
export interface AdminSubscriptionRow {
  id: string;
  user_id: string;
  household_id: string | null;
  tier: 'free' | 'family' | 'premium' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  monthly_amount: number;
  currency: string;
  started_at: string;
  renews_at: string | null;
  failure_count: number;
}
export async function fetchAllSubscriptions(): Promise<AdminSubscriptionRow[]> {
  const { data, error } = await sb()
    .from('subscriptions')
    .select('id,user_id,household_id,tier,status,monthly_amount,currency,started_at,renews_at,failure_count')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data as AdminSubscriptionRow[]) || [];
}

// ── Activity log (audit) ───────────────────────────────────────────
// ADM-03 (v1.4.5; owner decision 13 Oct 2026): who did what and when, never the values. The page reads
// the server feed `admin_activity_feed`, which never returns `activity_log.changes` (the row images:
// amounts, payees, descriptions, names). Admins can no longer read the table itself (members only).
export interface AdminActivityRow {
  id: string;
  actor_id: string | null;
  household_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}
export async function fetchActivityLog(limit = 200, before?: string): Promise<AdminActivityRow[]> {
  const { data, error } = await sb().rpc('admin_activity_feed', { p_limit: limit, p_before: before ?? null });
  if (error) throw error;
  return (data as AdminActivityRow[]) || [];
}

// ── Staff actions (ADM-04, v1.5.0) ─────────────────────────────────────
// What Vyact staff changed (roles, Learn content, needs/wants, AI model settings): who, when, which fields.
// Never the text. Super admins only; an empty actor is the Supabase dashboard or a migration.
export interface StaffAuditRow {
  id: number;
  at: string;
  actor_id: string | null;
  actor_email: string | null;
  action: 'insert' | 'update' | 'delete';
  target_table: 'admin_roles' | 'content_items' | 'category_classifications' | 'ai_model_configs';
  target_id: string | null;
  changed: string[];
  detail: Record<string, unknown>;
}
export async function fetchStaffAudit(limit = 200, before?: string): Promise<StaffAuditRow[]> {
  const { data, error } = await sb().rpc('admin_staff_audit', { p_limit: limit, p_before: before ?? null });
  if (error) throw error;
  return (data as StaffAuditRow[]) || [];
}

// ── Health (v1.6.0; Q4, OPS-06): every scheduled job against its cadence (roles tier) ──
export interface JobHealthRow {
  job: string;
  every_minutes: number;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_status: 'ok' | 'partial' | 'failed' | null;
  last_summary: Record<string, unknown> | null;
  last_error: string | null;
  runs_24h: number;
  failed_24h: number;
  problem: 'failed' | 'partial' | 'late' | null;
}
export async function fetchJobHealth(): Promise<JobHealthRow[]> {
  const { data, error } = await sb().rpc('admin_job_health');
  if (error) throw error;
  return (data as JobHealthRow[]) || [];
}
export interface JobRunRow {
  id: number;
  job: string;
  started_at: string;
  finished_at: string;
  status: 'ok' | 'partial' | 'failed';
  summary: Record<string, unknown>;
  error: string | null;
}
export async function fetchJobRuns(job: string, limit = 20): Promise<JobRunRow[]> {
  const { data, error } = await sb().rpc('admin_job_runs', { p_job: job, p_limit: limit });
  if (error) throw error;
  return (data as JobRunRow[]) || [];
}
