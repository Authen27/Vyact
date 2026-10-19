// recurring-post — the server posts due bills (W4a, v10.70.0; owner decision D16).
//
// pg_cron calls this every 30 minutes (x-cron-secret, checked against Vault; or the service key).
// For every live, active, auto-approved schedule that is due in its HOUSEHOLD's zone:
//   1. ask the APP's engine (bundled: serverEngine.recurringPostPlan) what it would do today —
//      the occurrence row under its deterministic id and the next date from the schedule's rule,
//      or a fast-forward when the pointer is past the catch-up horizon;
//   2. apply it with post_recurring_occurrence, which locks the schedule, re-checks it on the
//      database's own copy, writes the row (ON CONFLICT DO NOTHING) and moves the schedule on
//      in one transaction.
// A schedule that missed several occurrences (within the horizon) catches up in one run.
//
// Before this, each device posted bills from its own cache, so a stale device could post a bill
// that had been paused, edited or deleted elsewhere (audit INT-TXN-06). Loan EMIs stay with the
// app until the loan model (D19) posts them; the plan returns null for those.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, json, corsHeaders } from '../_shared/whatsapp.ts';
import { isServiceCaller } from '../_shared/service-auth.ts';
import { localDayIn } from '../_shared/localTime.ts';
import { recurringPostPlan } from '../_shared/agent/engine.ts';

const PAGE = 500;
/** Occurrences one schedule may post in one run (a daily bill 45 days behind, with room). */
const MAX_STEPS_PER_SCHEDULE = 62;
const COLUMNS = 'id, household_id, created_by, txn_template, frequency, day_of_month, weekday, start_date, next_due_date, '
  + 'last_generated, auto_confirm, active, reminder_lead_days, rrule, short_month_policy, owner_member_id, updated_at, '
  + 'households(timezone)';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const given = req.headers.get('x-cron-secret') ?? '';
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: cronOk } = given ? await admin.rpc('recurring_post_cron_ok', { p: given }) : { data: false };
  if (!cronOk && !(await isServiceCaller(bearer))) return json({ error: 'forbidden' }, 403);
  try {
    return json(await postDue(admin, new Date()));
  } catch (e) {
    console.error('[recurring-post] failed', (e as Error)?.message);
    return json({ error: 'post_failed' }, 500);
  }
});

export interface PostSummary { schedules: number; posted: number; alreadyPosted: number; fastForwarded: number; finished: number; errors: number }

type Row = Record<string, unknown> & { id: string; household_id: string; next_due_date: string; households?: { timezone?: string | null } | null };

export async function postDue(admin: SupabaseClient, now: Date): Promise<PostSummary> {
  // No household's day is later than UTC+14: anything due by then is a candidate; each one is
  // then judged in its own household's zone.
  const latest = localDayIn(now, 'Pacific/Kiritimati');
  const summary: PostSummary = { schedules: 0, posted: 0, alreadyPosted: 0, fastForwarded: 0, finished: 0, errors: 0 };
  for (let from = 0; from < 200 * PAGE; from += PAGE) {
    const { data, error } = await admin.from('recurring_schedules').select(COLUMNS)
      .is('deleted_at', null).eq('active', true).eq('auto_confirm', true).lte('next_due_date', latest)
      .order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`schedules: ${error.message}`);
    for (const row of (data ?? []) as unknown as Row[]) {
      summary.schedules++;
      await postSchedule(admin, row, localDayIn(now, row.households?.timezone), summary);
    }
    if (!data || data.length < PAGE) break;
  }
  return summary;
}

async function postSchedule(admin: SupabaseClient, initial: Row, today: string, summary: PostSummary): Promise<void> {
  let row: Row = initial;
  for (let step = 0; step < MAX_STEPS_PER_SCHEDULE; step++) {
    const plan = recurringPostPlan(row, row.household_id, today);
    if (!plan) return;
    const { data, error } = await admin.rpc('post_recurring_occurrence', {
      p_schedule_id: row.id,
      p_occurrence: plan.occurrence,
      p_post: plan.post,
      p_row: plan.row,
      p_next_due: plan.nextDue,
      p_last_generated: plan.lastGenerated,
      p_exhausted: plan.exhausted,
    });
    const r = (data ?? {}) as { status?: string; reason?: string; already_posted?: boolean };
    if (error || r.status === 'error') {
      summary.errors++;
      console.error('[recurring-post] schedule', row.id, error?.message ?? r.reason);
      return;
    }
    if (r.status === 'skipped') return;   // moved, paused or not due on the database's own copy
    if (r.status === 'posted') { if (r.already_posted) summary.alreadyPosted++; else summary.posted++; }
    if (r.status === 'fast_forwarded') summary.fastForwarded++;
    if (plan.exhausted) { summary.finished++; return; }
    // The database now holds the moved schedule; carry on from it (a missed run catches up).
    row = { ...row, next_due_date: plan.nextDue!, last_generated: plan.lastGenerated };
  }
}
