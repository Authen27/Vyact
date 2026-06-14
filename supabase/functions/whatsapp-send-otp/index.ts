// Vyact WhatsApp — send phone-link OTP (authenticated; deploy WITH JWT).
//
// Body: { phone: string, householdId: string }
// Auth: the caller's Supabase JWT (the React app). We confirm the user is a member
// of householdId, rate-limit, hash a fresh OTP, store it, and dispatch the approved
// `phone_verification_otp` template to the phone over WhatsApp.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, json, corsHeaders, normalisePhone, sha256Hex, generateOtp, sendTemplate } from '../_shared/whatsapp.ts';

const OTP_TTL_MS = 10 * 60 * 1000;     // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;  // 1 per 60s per phone (anti-spam)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  // Authenticate the caller.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: aErr } = await admin.auth.getUser(jwt);
  if (aErr || !user) return json({ error: 'unauthorized' }, 401);

  const { phone, householdId } = await req.json().catch(() => ({}));
  const e164 = normalisePhone(phone ?? '');
  if (e164.length < 8) return json({ error: 'invalid_phone' }, 400);
  if (!householdId) return json({ error: 'missing_household' }, 400);

  // The user must be a member of the household they're linking.
  const { data: membership } = await admin
    .from('memberships').select('id')
    .eq('household_id', householdId).eq('user_id', user.id).maybeSingle();
  if (!membership) return json({ error: 'not_a_member' }, 403);

  // Phone must not already be linked to a DIFFERENT verified profile.
  const { data: taken } = await admin
    .from('profiles').select('id')
    .eq('phone_number', e164).not('phone_verified_at', 'is', null).neq('id', user.id).maybeSingle();
  if (taken) return json({ error: 'phone_in_use' }, 409);

  // Rate-limit resends.
  const { data: recent } = await admin
    .from('whatsapp_verification_otps').select('created_at')
    .eq('profile_id', user.id).eq('phone_number', e164)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
    return json({ error: 'too_soon', retryAfterSeconds: 60 }, 429);
  }

  // Fresh OTP; clear any prior codes for this profile+phone.
  const otp = generateOtp();
  const pepper = env('WHATSAPP_OTP_PEPPER');                  // optional server pepper
  const otpHash = await sha256Hex(`${otp}:${e164}:${pepper}`);
  await admin.from('whatsapp_verification_otps')
    .delete().eq('profile_id', user.id).eq('phone_number', e164);
  const { error: insErr } = await admin.from('whatsapp_verification_otps').insert({
    profile_id: user.id, household_id: householdId, phone_number: e164,
    otp_hash: otpHash, expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (insErr) return json({ error: 'store_failed', detail: insErr.message }, 500);

  try {
    await sendTemplate(e164, 'phone_verification_otp', [otp]);
  } catch (e) {
    return json({ error: 'dispatch_failed', detail: (e as Error).message }, 502);
  }
  return json({ status: 'sent', expiresInSeconds: OTP_TTL_MS / 1000 });
});
