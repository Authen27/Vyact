// FinFlow Admin v8 — Supabase client
// Same project as the consumer app. The admin's privileges are gated by the
// `admin_roles` table (server-side RLS), not by env config — sign in is
// identical to the consumer app's auth flow.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudEnabled = (): boolean => Boolean(URL && KEY);

export const supabase: SupabaseClient | null = isCloudEnabled()
  ? createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: { headers: { 'X-Client-Info': 'finflow-admin/v1.0.1' } },
    })
  : null;

export function sb(): SupabaseClient {
  if (!supabase) throw new Error('Admin app: Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase;
}
