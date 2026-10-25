// Vyact Admin — Users (live auth.users through the roles-tier RPCs).
// v1.5.0 (ADM-08; ADM-04): a page of 100 at a time, searched on the server, with the headline counts from
// admin_people_summary. The whole list used to load at once, and past 1,000 people it was cut short without a word.
// Super admins grant and revoke staff roles here (grant_admin_role / revoke_admin_role, recorded in Staff actions).

import { useEffect, useState } from 'react';
import { Mail, Shield, RefreshCw } from 'lucide-react';
import { useAdminStore } from '../store';
import {
  fetchUsersPage, fetchPeopleSummary, grantAdminRole, revokeAdminRole, PAGE_SIZE,
  type AdminUserRow, type PeopleSummary,
} from '../lib/adminApi';
import { useDebounced } from '../lib/useDebounced';
import Pager from '../components/Pager';
import type { AdminRole } from '../types';

export default function Users() {
  const query = useDebounced(useAdminStore(s => s.query), 300);
  const serverRole = useAdminStore(s => s.serverRole);
  const role = useAdminStore(s => s.role);
  // Only a real super admin, not previewing a lower tier, changes roles.
  const canChangeRoles = serverRole === 'super' && role === 'super';
  const [users, setUsers]     = useState<AdminUserRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [offset, setOffset]   = useState(0);
  const [summary, setSummary] = useState<PeopleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tick, setTick]       = useState(0);

  useEffect(() => { setOffset(0); }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const [page, s] = await Promise.all([fetchUsersPage(offset, query), fetchPeopleSummary()]);
        if (!cancelled) { setUsers(page.rows); setTotal(page.total); setSummary(s); }
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick, offset, query]);

  const counts = summary?.users;

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Users</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {counts ? `${counts.total} users · ${counts.confirmed} email-confirmed · ${counts.admins} admins · live from production` : 'Live from production'}
          </p>
        </div>
        <button onClick={() => setTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="Total"           value={counts?.total} />
        <Metric label="Email confirmed" value={counts?.confirmed} tone="positive" />
        <Metric label="Admins"          value={counts?.admins} />
        <Metric label="In >1 household" value={counts?.multiHousehold} />
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>User</div>
          <div>Status</div>
          <div>Households</div>
          <div>Joined</div>
          <div>Last seen</div>
        </div>
        <div className="divide-y divide-line">
          {loading && <div className="px-4 py-6 text-center text-ink-mid text-sm">Loading…</div>}
          {!loading && users.length === 0 && (
            <div className="px-4 py-10 text-center text-ink-mid text-sm">
              {query ? `No users match "${query}"` : 'No users yet.'}
            </div>
          )}
          {!loading && users.map(u => (
            <div key={u.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 row-hover items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[0.86rem] font-semibold text-ink truncate">
                    {u.display_name || u.email.split('@')[0]}
                  </span>
                  {u.is_admin && (
                    <span className="font-mono text-[0.52rem] tracking-widest uppercase px-1.5 py-0.5 rounded bg-claude/15 text-claude flex items-center gap-1">
                      <Shield size={9} />{u.admin_role}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[0.62rem] text-ink-dim flex items-center gap-1">
                  <Mail size={10} /> {u.email}
                </div>
                {canChangeRoles && <RoleControl user={u} onChanged={() => setTick(t => t + 1)} onError={setError} />}
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${
                  u.email_confirmed ? 'bg-positive/15 text-positive' : 'bg-warn/15 text-warn'
                }`}>
                  {u.email_confirmed ? 'verified' : 'pending'}
                </span>
              </div>
              <div className="font-mono text-[0.78rem] text-ink-mid">{u.household_count}</div>
              <div className="font-mono text-[0.74rem] text-ink-mid">
                {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
              </div>
              <div className="font-mono text-[0.74rem] text-ink-mid">
                {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'never'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Pager offset={offset} total={total} onPage={setOffset} />

      <p className="mt-3 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>admin_list_users_page()</code> · {PAGE_SIZE} a page, searched on the server · counts from <code>admin_people_summary()</code>
      </p>
    </div>
  );
}

const ROLE_CHOICES: (AdminRole | 'none')[] = ['none', 'content', 'roles', 'super'];

/** Super admins only: change a person's staff role, after confirming. The server refuses removing the last super. */
function RoleControl({ user, onChanged, onError }: { user: AdminUserRow; onChanged: () => void; onError: (m: string) => void }) {
  const current: AdminRole | 'none' = user.admin_role ?? 'none';
  const [pending, setPending] = useState<AdminRole | 'none' | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (pending === null) return;
    setBusy(true);
    try {
      if (pending === 'none') await revokeAdminRole(user.id);
      else await grantAdminRole(user.id, pending);
      setPending(null);
      onChanged();
    } catch (e) {
      const msg = (e as Error).message;
      onError(/last_super_admin/.test(msg) ? 'Grant another super admin first: Vyact always keeps one.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
      <label className="mono-label" htmlFor={`role-${user.id}`}>Staff role</label>
      <select id={`role-${user.id}`} value={pending ?? current} disabled={busy}
        onChange={e => { const v = e.target.value as AdminRole | 'none'; setPending(v === current ? null : v); }}
        className="font-mono text-[0.65rem] bg-transparent border border-line rounded px-1.5 py-0.5">
        {ROLE_CHOICES.map(r => <option key={r} value={r}>{r === 'none' ? 'none' : r}</option>)}
      </select>
      {pending !== null && (
        <>
          <button type="button" onClick={confirm} disabled={busy}
            className="font-mono text-[0.6rem] tracking-wider uppercase px-2 py-0.5 rounded bg-claude text-white disabled:opacity-50">
            {pending === 'none' ? 'Remove role' : `Make ${pending}`}
          </button>
          <button type="button" onClick={() => setPending(null)} disabled={busy}
            className="font-mono text-[0.6rem] tracking-wider uppercase px-2 py-0.5 rounded border border-line">
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | undefined; tone?: 'positive' | 'warn' }) {
  const cls = tone === 'positive' ? 'text-positive' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div className="panel p-4">
      <div className="mono-label mb-1.5">{label}</div>
      <div className={`display-serif text-[1.6rem] leading-none ${cls}`}>{value ?? '—'}</div>
    </div>
  );
}
