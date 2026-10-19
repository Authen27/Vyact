// T5a (audit INT-PAR-11): the bundled engine and the shared Edge modules load and run under Deno.
//
// Every test of the server copy runs in Node (Vitest), where `engine.generated.js` and `_shared/` are
// imported through the app's own resolver. Production runs them in Deno. This loads them the way the Edge
// runtime does (remote imports and all) and calls a few pure functions, so a bundle or import that only
// breaks under Deno fails here, not in production. Run by .github/workflows/edge.yml:
//   deno run --allow-env --allow-read scripts/deno-smoke.ts
import * as engine from '../supabase/functions/_shared/agent/engine.generated.js';
import { notificationsOnServer, balancesToCheck } from '../supabase/functions/_shared/agent/engine.ts';
import { isPushEndpoint, MAX_PAYLOAD_BYTES } from '../supabase/functions/_shared/web-push.ts';
import { payloadFor, PAYLOAD_LIMIT_BYTES } from '../supabase/functions/_shared/web-push-rules.ts';
import { budgetAlerts } from '../supabase/functions/_shared/whatsapp-dispatch-rules.ts';

const check = (ok: boolean, what: string) => { if (!ok) throw new Error(`deno smoke: ${what}`); };

const rows = {
  transactions: [], budgets: [], budgetAllocations: [], goals: [], debts: [], assets: [], accounts: [], recurring: [],
  memberCount: 1, rates: [], profile: {}, email: 'smoke@example.com',
  household: { base_currency: 'INR', timezone: 'Asia/Kolkata' },
};

check(typeof (engine as Record<string, unknown>).notificationsOnServer === 'function', 'the bundle exports notificationsOnServer');
check(Array.isArray(notificationsOnServer(rows, [], 'h')), 'notificationsOnServer runs on an empty household');
check(Array.isArray(balancesToCheck(rows, Date.now())), 'balancesToCheck runs on an empty household');
check(isPushEndpoint('https://fcm.googleapis.com/fcm/send/x') && !isPushEndpoint('https://evil.example/x'), 'push hosts');
check(PAYLOAD_LIMIT_BYTES === MAX_PAYLOAD_BYTES, 'one payload limit');
check(payloadFor({ id: 'n', household_id: 'h', type: 'bill', priority: 'P1', title: 'T', body: null, status: 'unread',
  created_at: new Date().toISOString(), deep_link: '//evil', dedupe_key: 'k' }).url === '/', 'links stay in the app');
check(budgetAlerts({ household: { id: 'h', base_currency: 'INR' }, today: '2026-10-19', budgets: [], allocations: [],
  txns: [], members: [] }).length === 0, 'the WhatsApp rules load with the engine behind them');

console.log('✓ deno smoke: the engine bundle and shared Edge modules load and run under Deno');
