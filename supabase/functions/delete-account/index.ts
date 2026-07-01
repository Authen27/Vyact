// Vyact v9.8.0 — permanent account deletion (service role; deploy WITH JWT).
//
// Called by the Settings "Delete account permanently" flow once a user's
// 30-day undo window (profiles.deletion_scheduled_for) has passed, or
// immediately if the caller passes { immediate: true } (used for the
// "delete right now, skip the grace period" confirmation path).
//
// A client-side (anon-key) connection cannot drop rows from auth.users —
// that requires the service role, which only this function holds. Sequence:
//   1. Verify the caller's JWT identifies a real user.
//   2. Refuse unless a deletion has been requested (deletion_requested_at set)
//      AND (immediate=true OR deletion_scheduled_for has passed).
//   3. For every household the user OWNS: erase all financial rows, then
//      delete the household + its memberships/invitations outright.
//   4. For households the user only belongs to (not owner): remove their
//      membership row only — other members' data is untouched.
//   5. Delete the profiles row.
//   6. Delete the auth.users row via the Admin API — irreversible.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (k: string) => Deno.env.get(k) ?? '';

const HOUSEHOLD_SCOPED_TABLES = [
  'transactions', 'budgets', 'budget_allocations', 'goals', 'debts', 'assets',
  'accounts', 'recurring_schedules', 'saved_views', 'activity_log', 'invitations',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  const { immediate } = await req.json().catch(() => ({ immediate: false }));

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, deletion_requested_at, deletion_scheduled_for')
    .eq('id', user.id)
    .maybeSingle();
  if (profileErr || !profile) return json({ error: 'profile_not_found' }, 404);

  if (!profile.deletion_requested_at) {
    return json({ error: 'no_deletion_requested', detail: 'Call request_account_deletion() first.' }, 400);
  }
  const scheduledFor = profile.deletion_scheduled_for ? new Date(profile.deletion_scheduled_for) : null;
  const windowPassed = scheduledFor ? scheduledFor.getTime() <= Date.now() : true;
  if (!immediate && !windowPassed) {
    return json({ error: 'undo_window_open', scheduled_for: profile.deletion_scheduled_for }, 400);
  }

  const { data: memberships } = await admin
    .from('memberships')
    .select('id, household_id, role')
    .eq('user_id', user.id);

  const ownedHouseholdIds = (memberships ?? []).filter(m => m.role === 'owner').map(m => m.household_id);
  const otherMembershipIds = (memberships ?? []).filter(m => m.role !== 'owner').map(m => m.id);

  for (const householdId of ownedHouseholdIds) {
    for (const table of HOUSEHOLD_SCOPED_TABLES) {
      const { error } = await admin.from(table).delete().eq('household_id', householdId);
      if (error) return json({ error: 'erase_failed', table, detail: error.message }, 500);
    }
    await admin.from('memberships').delete().eq('household_id', householdId);
    const { error: hErr } = await admin.from('households').delete().eq('id', householdId);
    if (hErr) return json({ error: 'household_delete_failed', detail: hErr.message }, 500);
  }

  if (otherMembershipIds.length) {
    await admin.from('memberships').delete().in('id', otherMembershipIds);
  }

  await admin.from('profiles').delete().eq('id', user.id);

  const { error: authDeleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteErr) return json({ error: 'auth_delete_failed', detail: authDeleteErr.message }, 500);

  return json({ deleted: true });
});
