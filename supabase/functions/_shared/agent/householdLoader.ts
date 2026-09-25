// Ask Vyact on WhatsApp — load ONE household's rows for the engine (W4, v10.45.0).
//
// Service role, so every query is scoped by household_id explicitly, and only the
// household the verified WhatsApp identity is linked to is ever read. The rows are
// what the app's adapter reads (`list()`: live rows, deleted_at is null), and they
// are DRAINED page by page — PostgREST caps a response at ~1000 rows, and a
// silently truncated ledger is the Audit F8 bug class.
//
// No email is loaded: the engine never states it, so it is not read.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import type { HouseholdRows } from './engine.ts';

const PAGE = 1000;

async function drain(admin: SupabaseClient, table: string, householdId: string): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let from = 0; from < 200 * PAGE; from += PAGE) {
    const { data, error } = await admin.from(table).select('*')
      .eq('household_id', householdId).is('deleted_at', null)
      .order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadHouseholdRows(admin: SupabaseClient, profileId: string, householdId: string): Promise<HouseholdRows> {
  const [transactions, budgets, budgetAllocations, goals, debts, assets, accounts, recurring] = await Promise.all([
    drain(admin, 'transactions', householdId),
    drain(admin, 'budgets', householdId),
    drain(admin, 'budget_allocations', householdId),
    drain(admin, 'goals', householdId),
    drain(admin, 'debts', householdId),
    drain(admin, 'assets', householdId),
    drain(admin, 'accounts', householdId),
    drain(admin, 'recurring_schedules', householdId),
  ]);
  const [{ count: memberCount }, { data: rates }, { data: profile }, { data: household }] = await Promise.all([
    admin.from('memberships').select('id', { count: 'exact', head: true }).eq('household_id', householdId),
    admin.from('exchange_rates').select('currency_code, rate_to_usd').eq('household_id', householdId),
    admin.from('profiles').select('display_name, default_currency, language, date_format, education_progress').eq('id', profileId).maybeSingle(),
    admin.from('households').select('type, base_currency, language, payoff_strategy, extra_payment').eq('id', householdId).maybeSingle(),
  ]);
  if (!household) throw new Error('household not found');
  return {
    transactions, budgets, budgetAllocations, goals, debts, assets, accounts, recurring,
    memberCount: memberCount ?? 1,
    rates: (rates ?? []) as HouseholdRows['rates'],
    profile: (profile ?? {}) as HouseholdRows['profile'],
    household: household as HouseholdRows['household'],
    email: '',
  };
}
