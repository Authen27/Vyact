// FinFlow Admin v8 — Audit Log (live public.activity_log)

import { useEffect, useMemo, useState } from 'react';
import { Shield, Download, RefreshCw } from 'lucide-react';
import { useAdminStore } from '../store';
import { fetchActivityLog, type AdminActivityRow } from '../lib/adminApi';

export default function Audit() {
  const query = useAdminStore(s => s.query);
  const [rows,    setRows]    = useState<AdminActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tick,    setTick]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const data = await fetchActivityLog(200);
        if (!cancelled) setRows(data);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(r =>
      r.action.toLowerCase().includes(q) ||
      (r.entity_type ?? '').toLowerCase().includes(q) ||
      (r.actor_id ?? '').toLowerCase().includes(q));
  }, [rows, query]);

  function exportCsv() {
    const headers = ['created_at', 'actor_id', 'household_id', 'action', 'entity_type', 'entity_id', 'changes'];
    const lines = [headers.join(',')];
    for (const r of filtered) {
      const cells = [
        r.created_at, r.actor_id ?? '', r.household_id ?? '', r.action,
        r.entity_type ?? '', r.entity_id ?? '', JSON.stringify(r.changes ?? null),
      ].map(c => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `activity-log-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Audit Log</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {rows.length} entries · live from <code className="font-mono">public.activity_log</code> · append-only
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={!filtered.length}
            className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5 disabled:opacity-50">
            <Download size={11} /> Export CSV
          </button>
          <button onClick={() => setTick(t => t + 1)}
            className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">{error}</div>}

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_1fr_1fr_60px] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>When</div><div>Action</div><div>Entity</div><div>Actor</div><div></div>
        </div>
        <div className="divide-y divide-line">
          {loading && <div className="px-4 py-6 text-center text-ink-mid text-sm">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-ink-dim text-sm">
              {query ? `No entries match "${query}"` : 'Activity log is empty.'}
            </div>
          )}
          {filtered.map(r => (
            <div key={r.id} className="grid grid-cols-[140px_1fr_1fr_1fr_60px] gap-3 px-4 py-3 row-hover items-start">
              <div className="font-mono text-[0.7rem] text-ink-mid">
                {new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19)}
              </div>
              <div className="text-[0.84rem] font-semibold text-ink">{r.action}</div>
              <div className="text-[0.78rem] text-ink-mid">
                {r.entity_type ?? '—'}
                {r.entity_id && (
                  <span className="font-mono text-[0.62rem] text-ink-dim ml-1">{r.entity_id.slice(0, 8)}…</span>
                )}
              </div>
              <div className="font-mono text-[0.7rem] text-ink-mid truncate">
                {r.actor_id ? r.actor_id.slice(0, 8) + '…' : 'system'}
              </div>
              <div className="text-right">
                {r.changes != null && (
                  <details>
                    <summary className="cursor-pointer text-ink-dim hover:text-claude" title="Show diff">
                      <Shield size={12} className="inline" />
                    </summary>
                    <pre className="mt-2 text-[0.65rem] font-mono bg-elev rounded p-2 overflow-auto max-h-40 text-left absolute z-10">
                      {JSON.stringify(r.changes, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>public.activity_log</code> · last 200 entries · admins read-all via RLS policy
      </p>
    </div>
  );
}
