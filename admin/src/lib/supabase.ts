// Vyact Admin v1.1.0 — Supabase client
// Same project as the consumer app. The admin's privileges are gated by the
// `admin_roles` table (server-side RLS), not by env config — sign in is
// identical to the consumer app's auth flow.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// PUBLIC client config, from the build's env only. v1.5.0 (ADM-09): the production fallback is gone, so a build
// with no env of its own never quietly reaches production. Production builds read the committed .env.production;
// staging/develop previews get vyact-test from Vercel's Preview env (other branches are not built; previewGuard.ts).
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudEnabled = (): boolean => Boolean(URL && KEY);
/** W8c (ADM-12): the project the client actually talks to (Settings shows its ref). */
export const SUPABASE_URL: string | null = URL ?? null;
/** W8c: the build's own version (it read v1.1.0 for four releases); 'dev' under vitest. */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export const supabase: SupabaseClient | null = isCloudEnabled()
  ? createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: { headers: { 'X-Client-Info': `vyact-admin/v${APP_VERSION}` } },
    })
  : null;

export function sb(): SupabaseClient {
  if (!supabase) throw new Error('Admin app: Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase;
}
