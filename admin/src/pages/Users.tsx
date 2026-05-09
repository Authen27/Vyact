import { useMemo, useState } from 'react';
import { Mail, Ban, Shield, MoreHorizontal } from 'lucide-react';
import { useAdminStore } from '../store';
import { MOCK_USERS } from '../lib/mockData';
import type { User, UserStatus, SubTier } from '../types';

const STATUS_COLOR: Record<UserStatus, string> = {
  active:    'bg-positive/15 text-positive',
  invited:   'bg-info/15 text-info',
  suspended: 'bg-danger/15 text-danger',
  churned:   'bg-ink-dim/15 text-ink-dim',
};

const TIER_COLOR: Record<SubTier, string> = {
  free:       'text-ink-dim',
  family:     'text-claude',
  premium:    'text-warn',
  enterprise: 'text-info',
};

export default function Users() {
  const query = useAdminStore(s => s.query);
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [tierFilter, setTierFilter] = useState<'all' | SubTier>('all');

  const filtered = useMemo(() => {
    let f = [...MOCK_USERS];
    if (statusFilter !== 'all') f = f.filter(u => u.status === statusFilter);
    if (tierFilter !== 'all') f = f.filter(u => u.subscriptionTier === tierFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      f = f.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.country.toLowerCase().includes(q));
    }
    return f.slice(0, 100);
  }, [query, statusFilter, tierFilter]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="display-serif text-3xl text-ink mb-1">Users</h1>
        <p className="text-ink-mid text-[0.92rem]">{MOCK_USERS.length} total · showing {filtered.length}</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | UserStatus)}
          className="bg-surface border border-line rounded-md px-3 py-1.5 text-[0.84rem] outline-none focus:border-claude">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="suspended">Suspended</option>
          <option value="churned">Churned</option>
        </select>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value as 'all' | SubTier)}
          className="bg-surface border border-line rounded-md px-3 py-1.5 text-[0.84rem] outline-none focus:border-claude">
          <option value="all">All tiers</option>
          <option value="free">Free</option>
          <option value="family">Family</option>
          <option value="premium">Premium</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_60px] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>User</div><div>Status</div><div>Tier</div><div>Country</div><div className="text-right">Pulse</div><div className="text-right">Last seen</div><div></div>
        </div>
        <div className="divide-y divide-line">
          {filtered.map(u => (
            <UserRow key={u.id} user={u} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UserRow({ user: u }: { user: User }) {
  const initials = u.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_60px] gap-3 px-4 py-3 row-hover items-center">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-claude/15 text-claude font-mono font-bold text-xs flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-[0.86rem] font-semibold text-ink truncate">{u.name}</div>
          <div className="font-mono text-[0.62rem] text-ink-dim truncate">{u.email}</div>
        </div>
      </div>
      <div>
        <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${STATUS_COLOR[u.status]}`}>
          {u.status}
        </span>
      </div>
      <div className={`font-mono text-[0.78rem] capitalize ${TIER_COLOR[u.subscriptionTier]}`}>{u.subscriptionTier}</div>
      <div className="font-mono text-[0.78rem] text-ink-mid">{u.country}</div>
      <div className="text-right">
        <span className={`font-mono text-[0.86rem] font-semibold ${(u.pulseScore || 0) >= 70 ? 'text-positive' : (u.pulseScore || 0) >= 50 ? 'text-warn' : 'text-danger'}`}>
          {u.pulseScore}
        </span>
      </div>
      <div className="font-mono text-[0.7rem] text-ink-dim text-right">{u.lastSeen}</div>
      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
        <button className="p-1 hover:text-info" title="Email"><Mail size={13} /></button>
        <button className="p-1 hover:text-warn" title="Suspend"><Ban size={13} /></button>
        <button className="p-1 hover:text-claude" title="Change role"><Shield size={13} /></button>
        <button className="p-1" title="More"><MoreHorizontal size={13} /></button>
      </div>
    </div>
  );
}
