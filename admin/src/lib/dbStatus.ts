// W8c (audit ADM-12) — what the Settings page may claim about the database: only what a live round-trip
// just showed. It used to print "connected" unconditionally, next to a hard-coded project ref and region.
import type { SupabaseClient } from '@supabase/supabase-js';

export type DbStatus = 'checking' | 'connected' | 'unreachable' | 'not_configured';

/** One cheap authenticated read (a head count of admin_roles, which an admin may read). */
export async function pingDatabase(client: Pick<SupabaseClient, 'from'> | null): Promise<Exclude<DbStatus, 'checking'>> {
  if (!client) return 'not_configured';
  try {
    const { error } = await client.from('admin_roles').select('user_id', { count: 'exact', head: true });
    return error ? 'unreachable' : 'connected';
  } catch {
    return 'unreachable';
  }
}

/** "https://abcd.supabase.co" → "abcd"; anything else → null (shown as "not set"). */
export function projectRefOf(url: string | null | undefined): string | null {
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i.exec(String(url ?? ''));
  return m ? m[1] : null;
}
