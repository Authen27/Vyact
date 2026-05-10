// FinFlow Admin v8 — Users (live auth.users via admin_list_users RPC)

import { useEffect, useMemo, useState } from 'react';
import { Mail, Shield, RefreshCw } from 'lucide-react';
import { useAdminStore } from '../store';
import { fetchAllUsers, type AdminUserRow } from '../lib/adminApi';

export default function Users() {
  const query = useAdminStore(s => s.query);
  const [users, setUsers]     = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tick, setTick]       = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const data = await fetchAllUsers();
        if (!cancelled) setUsers(data);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q));
  }, [users, query]);

  const counts = useMemo(() => ({
    total: users.length,
    confirmed: users.filter(u => u.email_confirmed).length,
    admins: users.filter(u => u.is_admin).length,
    multiHousehold: users.filter(u => u.household_count > 1).length,
  }), [users]);

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Users</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {counts.total} users · {counts.confirmed} email-confirmed · {counts.admins} admins · live from production
          </p>
        </div>
        <button onClick={() => setTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="Total"           value={counts.total} />
        <Metric label="Email confirmed" value={counts.confirmed} tone="positive" />
        <Metric label="Admins"          value={counts.admins} />
        <Metric label="In >1 household" value={counts.multiHousehold} />
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
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-ink-mid text-sm">
              {query ? `No users match "${query}"` : 'No users yet.'}
            </div>
          )}
          {filtered.map(u => (
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

      <p className="mt-3 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>public.admin_list_users()</code> · joins <code>auth.users</code> + <code>profiles</code> + <code>memberships</code> + <code>admin_roles</code>
      </p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'positive' | 'warn' }) {
  const cls = tone === 'positive' ? 'text-positive' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div className="panel p-4">
      <div className="mono-label mb-1.5">{label}</div>
      <div className={`display-serif text-[1.6rem] leading-none ${cls}`}>{value}</div>
    </div>
  );
}
