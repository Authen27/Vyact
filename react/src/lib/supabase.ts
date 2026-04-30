// FinFlow v4.1 — Supabase client
//
// Singleton client. Exports `supabase` (or null if not configured).
// Use `isCloudEnabled()` to gate cloud-aware features so the app
// continues to work in pure-localStorage mode for users who haven't
// set up Supabase yet.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : '');

export const isCloudEnabled = (): boolean => Boolean(URL && KEY);

export const supabase: SupabaseClient | null = isCloudEnabled()
  ? createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,    // for magic-link redirects
        flowType: 'pkce',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

/**
 * Throws if cloud isn't configured. Use in code paths that REQUIRE Supabase
 * (auth, multi-household, invitations). Local features can simply check
 * isCloudEnabled() and gracefully degrade.
 */
export function sb(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Cloud not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.'
    );
  }
  return supabase;
}
