// FinFlow Admin v8 — Auth + admin role lookup
// Sign-in is the same email/password flow as the consumer app. Privilege is
// determined by the server-side admin_roles table (RLS-enforced).

import { sb, supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import type { AdminRole } from '../types';

export async function signIn(email: string, password: string) {
  const { data, error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await sb().auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(handler: (s: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, sess) => handler(sess));
  return () => data.subscription.unsubscribe();
}

/** Reads the current user's row from public.admin_roles. Returns null if the
 *  user is not an admin (RLS will hide other rows even if the user is logged in).
 *
 *  Pass `userId` when you already have it (e.g. from the session inside an
 *  onAuthStateChange callback). This avoids calling `supabase.auth.getUser()`,
 *  which contends for the GoTrue auth lock and deadlocks if invoked while the
 *  lock is held (as it is inside onAuthStateChange). */
export async function fetchMyAdminRole(userId?: string): Promise<AdminRole | null> {
  if (!supabase) return null;
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    uid = user.id;
  }
  const { data, error } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) {
    console.warn('[admin] fetchMyAdminRole error:', error.message);
    return null;
  }
  return (data?.role as AdminRole) || null;
}
