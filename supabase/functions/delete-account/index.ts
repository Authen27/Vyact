// Vyact — permanent account deletion (service role; deploy WITH JWT).
//
// W1b (v10.63.0, audit 2026-10-04; owner decisions D22 + D25): deletion is IMMEDIATE and the
// data side happens in ONE database transaction. The old version ran a chain of separate
// deletes from here, then failed on foreign keys for anyone who had ever written into a
// household they did not own — their data was gone but their login stayed — and it deleted
// co-members' households outright when an owner left. The 30-day schedule it served was never
// executed by anything.
//
//   1. The JWT identifies a real user.
//   2. Recent sign-in, enforced HERE (it used to be checked only in the browser): the token's
//      `amr` must record an authentication within the last 10 minutes. Settings asks for the
//      emailed code first, and verifyOtp issues a fresh session; an idle or stolen session is
//      refused with `reauth_required`.
//   3. purge_account(user) — one transaction: refuses `transfer_required` when they own a
//      household other people use; deletes households where they are the only member (and
//      everything in them); removes their other memberships; deletes their WhatsApp, push,
//      pending-invitation and profile rows. Shared history stays and stops naming them.
//   4. The auth user is deleted last. If that step fails the purge has already happened and a
//      retry is safe (purge_account is idempotent).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const env = (k: string) => Deno.env.get(k) ?? '';

export const REAUTH_MAX_AGE_SECONDS = 600;

/** The most recent authentication time (unix seconds) recorded in a JWT's `amr` claim. */
export function lastAuthenticatedAt(jwt: string): number | null {
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const claims = JSON.parse(atob(b64)) as { amr?: Array<{ timestamp?: unknown }> };
    const times = (claims.amr ?? []).map((a) => a?.timestamp).filter((t): t is number => typeof t === 'number');
    return times.length ? Math.max(...times) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  const authedAt = lastAuthenticatedAt(jwt);
  if (authedAt === null || Date.now() / 1000 - authedAt > REAUTH_MAX_AGE_SECONDS) {
    return json({ error: 'reauth_required', detail: 'Confirm with the code we email you, then delete within 10 minutes.' }, 401);
  }

  const { error: purgeErr } = await admin.rpc('purge_account', { p_user_id: user.id });
  if (purgeErr) {
    if (/transfer_required/.test(purgeErr.message ?? '')) {
      const households = String((purgeErr as { details?: string }).details ?? '').split(',').filter(Boolean);
      return json({ error: 'transfer_required', households,
        detail: 'You own a household other people use. Make one of them the owner first (Households › Members).' }, 409);
    }
    return json({ error: 'purge_failed', detail: purgeErr.message }, 500);
  }

  const { error: authDeleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteErr) return json({ error: 'auth_delete_failed', detail: authDeleteErr.message, retry: true }, 500);

  return json({ deleted: true });
});
