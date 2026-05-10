// FinFlow Admin v8 — Data fetchers (live Supabase)
// Every page reads from this module. Mock data is gone.

import { sb } from './supabase';
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
  mrr: number;
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

export async function fetchAllUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await sb().rpc('admin_list_users');
  if (error) throw error;
  return (data as AdminUserRow[]) || [];
}

// ── Households ─────────────────────────────────────────────────────
export interface AdminHouseholdRow {
  id: string;
  name: string;
  type: 'personal' | 'family' | 'business' | 'multi_biz' | 'shared';
  base_currency: string;
  created_by: string;
  created_at: string;
  member_count: number;
}

export async function fetchAllHouseholds(): Promise<AdminHouseholdRow[]> {
  // Read households + count memberships per household
  const { data: hh, error: hhErr } = await sb()
    .from('households')
    .select('id,name,type,base_currency,created_by,created_at')
    .order('created_at', { ascending: false });
  if (hhErr) throw hhErr;

  const { data: members, error: mErr } = await sb()
    .from('memberships')
    .select('household_id');
  if (mErr) throw mErr;

  const counts = new Map<string, number>();
  (members || []).forEach((m: { household_id: string }) => {
    counts.set(m.household_id, (counts.get(m.household_id) || 0) + 1);
  });

  return (hh || []).map(h => ({
    ...(h as Omit<AdminHouseholdRow, 'member_count'>),
    member_count: counts.get(h.id) || 0,
  }));
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
export interface AdminActivityRow {
  id: string;
  actor_id: string | null;
  household_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  changes: unknown;
  created_at: string;
}
export async function fetchActivityLog(limit = 200): Promise<AdminActivityRow[]> {
  const { data, error } = await sb()
    .from('activity_log')
    .select('id,actor_id,household_id,action,entity_type,entity_id,changes,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AdminActivityRow[]) || [];
}
