// Is a request's bearer a service-role credential? (v10.47.1)
//
// Server-to-server calls (whatsapp-notify, the webhook's sweep, whatsapp-dispatch)
// accept the service role. The byte-for-byte match with the runtime's own
// SUPABASE_SERVICE_ROLE_KEY is not enough on its own: with Supabase's new API keys,
// that variable need not be the legacy service_role JWT the dashboard shows. On
// 26 Sep a correct legacy key, pasted into the dashboard's Test panel for
// whatsapp-notify, got 401. So a bearer that CLAIMS the service role (a legacy JWT
// whose role claim says so, or an `sb_secret_` key) is checked by PostgREST, which
// verifies the signature: only a service-role credential can read a table revoked
// from anon and authenticated. The claim alone is never trusted.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, constantTimeEqual } from './whatsapp.ts';

/** The `role` claim of a JWT, unverified (null when the bearer is not a JWT). */
export function claimedRole(bearer: string): string | null {
  const parts = bearer.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
    return typeof json?.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

export async function isServiceCaller(bearer: string): Promise<boolean> {
  if (!bearer) return false;
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && constantTimeEqual(bearer, serviceKey)) return true;
  if (claimedRole(bearer) !== 'service_role' && !bearer.startsWith('sb_secret_')) return false;
  const probe = createClient(env('SUPABASE_URL'), bearer, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { error } = await probe.from('whatsapp_pending_turns').select('id', { head: true, count: 'exact' }).limit(1);
  return !error;
}
