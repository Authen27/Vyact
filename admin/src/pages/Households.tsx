// FinFlow Admin v8 — Households (live public.households + memberships)

import { useEffect, useMemo, useState } from 'react';
import { Home, RefreshCw } from 'lucide-react';
import { useAdminStore } from '../store';
import { fetchAllHouseholds, type AdminHouseholdRow } from '../lib/adminApi';

const TYPE_COLOR: Record<AdminHouseholdRow['type'], string> = {
  personal:  'bg-claude/10 text-claude',
  family:    'bg-positive/15 text-positive',
  business:  'bg-warn/15 text-warn',
  multi_biz: 'bg-info/15 text-info',
  shared:    'bg-tan/30 text-ink',
};

export default function Households() {
  const query = useAdminStore(s => s.query);
  const [rows,    setRows]    = useState<AdminHouseholdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tick,    setTick]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const data = await fetchAllHouseholds();
        if (!cancelled) setRows(data);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.type.toLowerCase().includes(q) ||
      h.base_currency.toLowerCase().includes(q));
  }, [rows, query]);

  const counts = useMemo(() => ({
    total:      rows.length,
    multi:      rows.filter(h => h.member_count >= 2).length,
    family:     rows.filter(h => h.type === 'family').length,
    business:   rows.filter(h => h.type === 'business' || h.type === 'multi_biz').length,
  }), [rows]);

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Households</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {counts.total} households · {counts.multi} multi-member · live from production
          </p>
        </div>
        <button onClick={() => setTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="Total"        value={counts.total} />
        <Metric label="Multi-member" value={counts.multi}    tone="positive" />
        <Metric label="Family"       value={counts.family} />
        <Metric label="Business"     value={counts.business} />
      </div>

      {loading ? (
        <div className="panel p-10 text-center text-ink-mid text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center text-ink-mid text-sm">
          {query ? `No households match "${query}"` : 'No households yet.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(h => (
            <div key={h.id} className="panel p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Home size={14} className="text-ink-dim flex-shrink-0" />
                  <span className="text-[0.92rem] font-semibold text-ink truncate">{h.name}</span>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${TYPE_COLOR[h.type] ?? 'bg-line2 text-ink-dim'}`}>
                  {h.type}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <div className="mono-label mb-0.5">Members</div>
                  <div className="display-serif text-[1.3rem] leading-none text-ink">{h.member_count}</div>
                </div>
                <div>
                  <div className="mono-label mb-0.5">Currency</div>
                  <div className="display-serif text-[1.3rem] leading-none text-ink">{h.base_currency}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-line font-mono text-[0.62rem] text-ink-dim">
                Created {new Date(h.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>public.households</code> · member counts from <code>public.memberships</code>
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
