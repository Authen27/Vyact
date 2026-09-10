// Vyact WhatsApp — verify phone-link OTP (authenticated; deploy WITH JWT).
//
// Body: { code: string }
// On a correct, unexpired code it links the phone + household to the user via
// the SERVER-OWNED `whatsapp_identities` table (audit S1) — clients can no
// longer write the legacy profiles.phone_* columns (trigger-frozen).
// Includes an attempt limiter (online brute-force protection over the 10^6 space).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, json, corsHeaders, sha256Hex, constantTimeEqual } from '../_shared/whatsapp.ts';

const MAX_ATTEMPTS = 5;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: aErr } = await admin.auth.getUser(jwt);
  if (aErr || !user) return json({ error: 'unauthorized' }, 401);

  const { code, action } = await req.json().catch(() => ({}));
  if (action === 'status') {
    const { data, error } = await admin.from('whatsapp_identities')
      .select('phone_number, household_id').eq('profile_id', user.id).maybeSingle();
    if (error) return json({ error: 'status_failed' }, 500);
    return json(data ? { status: 'linked', phone: data.phone_number, householdId: data.household_id } : { status: 'unlinked' });
  }
  if (action === 'unlink') {
    const { error: otpError } = await admin.from('whatsapp_verification_otps').delete().eq('profile_id', user.id);
    if (otpError) return json({ error: 'unlink_failed' }, 500);
    const { error } = await admin.from('whatsapp_identities').delete().eq('profile_id', user.id);
    if (error) return json({ error: 'unlink_failed' }, 500);
    return json({ status: 'unlinked' });
  }
  if (!code || !/^\d{4,8}$/.test(String(code))) return json({ error: 'invalid_code_format' }, 400);

  // Latest unexpired OTP for this user.
  const { data: otp } = await admin
    .from('whatsapp_verification_otps')
    .select('id, household_id, phone_number, otp_hash, attempts, expires_at')
    .eq('profile_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!otp) return json({ error: 'no_active_code' }, 400);

  if (otp.attempts >= MAX_ATTEMPTS) {
    await admin.from('whatsapp_verification_otps').delete().eq('id', otp.id);
    return json({ error: 'too_many_attempts' }, 429);
  }

  const pepper = env('WHATSAPP_OTP_PEPPER');
  const candidate = await sha256Hex(`${String(code)}:${otp.phone_number}:${pepper}`);
  if (!constantTimeEqual(candidate, otp.otp_hash)) {
    await admin.from('whatsapp_verification_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
    return json({ error: 'incorrect_code', attemptsLeft: MAX_ATTEMPTS - otp.attempts - 1 }, 400);
  }

  // Success → record the verified identity in the server-owned table,
  // purge OTPs. One identity per profile; re-linking replaces it.
  const { error: upErr } = await admin.from('whatsapp_identities').upsert({
    profile_id: user.id,
    phone_number: otp.phone_number,
    household_id: otp.household_id,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id' });
  if (upErr) return json({ error: 'link_failed', detail: upErr.message }, 500);
  await admin.from('whatsapp_verification_otps').delete().eq('profile_id', user.id);

  return json({ status: 'linked', phone: otp.phone_number, householdId: otp.household_id });
});
