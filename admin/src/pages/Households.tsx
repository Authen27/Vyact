// Vyact Admin — Households (live, through the roles-tier RPCs).
// v1.5.0 (ADM-08, INT-HH-14): a page of 100 at a time, searched by name on the server, with member counts and the
// headline counts counted on the server. The page read every household and every membership, and past 1,000 rows
// both the list and the counts were cut short.

import { useEffect, useState } from 'react';
import { Home, RefreshCw } from 'lucide-react';
import { useAdminStore } from '../store';
import { fetchHouseholdsPage, fetchPeopleSummary, PAGE_SIZE, type AdminHouseholdRow, type PeopleSummary } from '../lib/adminApi';
import { useDebounced } from '../lib/useDebounced';
import Pager from '../components/Pager';

// W8c (audit INT-CON-06): today's four types (couple added; retired multi_biz/shared are normalised).
const TYPE_COLOR: Record<AdminHouseholdRow['type'], string> = {
  personal:  'bg-claude/10 text-claude',
  couple:    'bg-info/15 text-info',
  family:    'bg-positive/15 text-positive',
  business:  'bg-warn/15 text-warn',
};

export default function Households() {
  const query = useDebounced(useAdminStore(s => s.query), 300);
  const [rows,    setRows]    = useState<AdminHouseholdRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [offset,  setOffset]  = useState(0);
  const [summary, setSummary] = useState<PeopleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tick,    setTick]    = useState(0);

  useEffect(() => { setOffset(0); }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const [page, s] = await Promise.all([fetchHouseholdsPage(offset, query), fetchPeopleSummary()]);
        if (!cancelled) { setRows(page.rows); setTotal(page.total); setSummary(s); }
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick, offset, query]);

  const filtered = rows;
  const hh = summary?.households;
  const counts = {
    total:      hh?.total,
    multi:      hh?.multiMember,
    couple:     hh ? hh.byType.couple ?? 0 : undefined,
    family:     hh ? hh.byType.family ?? 0 : undefined,
    business:   hh ? hh.byType.business ?? 0 : undefined,
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Households</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {hh ? `${counts.total} households · ${counts.multi} multi-member · live from production` : 'Live from production'}
          </p>
        </div>
        <button onClick={() => setTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Metric label="Total"        value={counts.total} />
        <Metric label="Multi-member" value={counts.multi}    tone="positive" />
        <Metric label="Couple"       value={counts.couple} />
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

      <Pager offset={offset} total={total} onPage={setOffset} />

      <p className="mt-4 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>admin_list_households()</code> · {PAGE_SIZE} a page, searched by name on the server · counts from <code>admin_people_summary()</code>
      </p>
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
