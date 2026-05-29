// FinFlow Admin v8 — Supabase client
// Same project as the consumer app. The admin's privileges are gated by the
// `admin_roles` table (server-side RLS), not by env config — sign in is
// identical to the consumer app's auth flow.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// PUBLIC client config — prefer build-time env, fall back to the known public
// project URL + publishable key in PRODUCTION builds so the deployed admin is
// always DB-connected regardless of host env-injection quirks (see the
// consumer supabase.ts note). Public values; RLS + admin_roles enforce access.
const FALLBACK_URL = 'https://dmxqkvploojokffuhxnz.supabase.co';
const FALLBACK_KEY = 'sb_publishable_SpuQFPzUWOnKI3nRR6ghNw_ktWqrKCA';
const URL = (import.meta.env.VITE_SUPABASE_URL  as string | undefined) || (import.meta.env.PROD ? FALLBACK_URL : undefined);
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || (import.meta.env.PROD ? FALLBACK_KEY : undefined);

export const isCloudEnabled = (): boolean => Boolean(URL && KEY);

export const supabase: SupabaseClient | null = isCloudEnabled()
  ? createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: { headers: { 'X-Client-Info': 'finflow-admin/v1.0.5' } },
    })
  : null;

export function sb(): SupabaseClient {
  if (!supabase) throw new Error('Admin app: Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase;
}
