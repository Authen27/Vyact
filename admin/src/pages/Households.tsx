import { useMemo } from 'react';
import { useAdminStore } from '../store';
import { MOCK_HOUSEHOLDS, MOCK_USERS } from '../lib/mockData';
import type { Household } from '../types';

const TYPE_ICON: Record<Household['type'], string> = {
  personal: '👤', family: '👨‍👩‍👧‍👦', business: '🏢', multi_biz: '🏛️', shared: '🤝',
};

export default function Households() {
  const query = useAdminStore(s => s.query);
  const ownersById = useMemo(() => new Map(MOCK_USERS.map(u => [u.id, u])), []);

  const filtered = useMemo(() => {
    if (!query.trim()) return MOCK_HOUSEHOLDS.slice(0, 100);
    const q = query.toLowerCase();
    return MOCK_HOUSEHOLDS
      .filter(h => h.name.toLowerCase().includes(q) || ownersById.get(h.ownerId)?.email.toLowerCase().includes(q))
      .slice(0, 100);
  }, [query, ownersById]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="display-serif text-3xl text-ink mb-1">Households</h1>
        <p className="text-ink-mid text-[0.92rem]">
          {MOCK_HOUSEHOLDS.length} total · {MOCK_HOUSEHOLDS.filter(h => h.activeMemberCount >= 2).length} multi-member · showing {filtered.length}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(h => {
          const owner = ownersById.get(h.ownerId);
          return (
            <div key={h.id} className="panel p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="text-xl">{TYPE_ICON[h.type]}</div>
                <span className="font-mono text-[0.55rem] tracking-wider uppercase text-ink-dim">
                  {h.baseCurrency}
                </span>
              </div>
              <div className="font-semibold text-ink mb-0.5">{h.name}</div>
              <div className="font-mono text-[0.62rem] tracking-wide uppercase text-ink-dim mb-2.5">
                {h.type.replace('_', ' ')}
              </div>
              <div className="flex justify-between items-center text-[0.78rem] text-ink-mid">
                <span>👤 {h.memberCount} members</span>
                <span className={`font-mono ${h.activeMemberCount >= 2 ? 'text-positive' : 'text-warn'}`}>
                  {h.activeMemberCount} active
                </span>
              </div>
              <div className="border-t border-line pt-2.5 mt-2.5 font-mono text-[0.6rem] text-ink-dim">
                Owner: <span className="text-ink-mid">{owner?.email}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
