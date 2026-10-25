// Vyact Admin — Audit Log, newest first, in two tabs.
// Household activity — ADM-03 (v1.4.5; owner decision 13 Oct 2026): who did what and when, never the values. Rows
//   come from `admin_activity_feed`, which has no `changes`; neither the page nor the CSV shows any. Since v10.130.0
//   an entry the server wrote has its sender as actor (WhatsApp), or none: "Vyact (automatic)" (a scheduled job).
// Staff actions — ADM-04 (v1.5.0): what Vyact staff changed (roles, Learn content, needs/wants, AI model settings),
//   from the append-only `admin_audit` through `admin_staff_audit`. Super admins only; never the text itself.

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useAdminStore } from '../store';
import { fetchActivityLog, fetchStaffAudit, type AdminActivityRow, type StaffAuditRow } from '../lib/adminApi';
import { activityActorLabel, staffActorLabel, staffChangeSummary, STAFF_TABLE_LABEL } from '../lib/auditLabels';

export default function Audit() {
  const role = useAdminStore(s => s.role);
  const serverRole = useAdminStore(s => s.serverRole);
  const canSeeStaff = role === 'super' && serverRole === 'super';
  const [tab, setTab] = useState<'household' | 'staff'>('household');
  return (
    <div>
      {canSeeStaff && (
        <div role="tablist" aria-label="Audit log" className="flex gap-1 mb-5 font-mono text-[0.62rem] tracking-wider uppercase">
          {(['household', 'staff'] as const).map(t => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md border ${tab === t ? 'border-claude text-claude bg-claude/10' : 'border-line text-ink-mid'}`}>
              {t === 'household' ? 'Household activity' : 'Staff actions'}
            </button>
          ))}
        </div>
      )}
      {canSeeStaff && tab === 'staff' ? <StaffActions /> : <HouseholdActivity />}
    </div>
  );
}

function StaffActions() {
  const [rows, setRows] = useState<StaffAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try { const data = await fetchStaffAudit(200); if (!cancelled) setRows(data); }
      catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick]);
  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Staff actions</h1>
          <p className="text-ink-mid text-[0.92rem]">{rows.length} entries · roles, Learn content, needs/wants and AI settings · cannot be edited</p>
        </div>
        <button onClick={() => setTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {error && <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">{error}</div>}
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_2fr_1fr] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>When</div><div>What</div><div>Change</div><div>Who</div>
        </div>
        <div className="divide-y divide-line">
          {loading && <div className="px-4 py-6 text-center text-ink-mid text-sm">Loading…</div>}
          {!loading && rows.length === 0 && <div className="px-4 py-10 text-center text-ink-dim text-sm">No staff changes recorded yet.</div>}
          {!loading && rows.map(r => (
            <div key={r.id} className="grid grid-cols-[140px_1fr_2fr_1fr] gap-3 px-4 py-3 row-hover items-start">
              <div className="font-mono text-[0.7rem] text-ink-mid">{new Date(r.at).toISOString().replace('T', ' ').slice(0, 19)}</div>
              <div className="text-[0.84rem] font-semibold text-ink">{STAFF_TABLE_LABEL[r.target_table]} · {r.action}</div>
              <div className="text-[0.78rem] text-ink-mid break-words">{staffChangeSummary(r)}</div>
              <div className="font-mono text-[0.7rem] text-ink-mid truncate">{staffActorLabel(r)}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>admin_staff_audit()</code> · last 200 · the record cannot be edited or deleted
      </p>
    </div>
  );
}

function HouseholdActivity() {
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
    const headers = ['created_at', 'actor_id', 'household_id', 'action', 'entity_type', 'entity_id'];
    const lines = [headers.join(',')];
    for (const r of filtered) {
      const cells = [
        r.created_at, r.actor_id ?? '', r.household_id ?? '', r.action,
        r.entity_type ?? '', r.entity_id ?? '',
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
            {rows.length} entries · household activity · who, what and when, never the values
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
        <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>When</div><div>Action</div><div>Entity</div><div>Actor</div>
        </div>
        <div className="divide-y divide-line">
          {loading && <div className="px-4 py-6 text-center text-ink-mid text-sm">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-ink-dim text-sm">
              {query ? `No entries match "${query}"` : 'Activity log is empty.'}
            </div>
          )}
          {filtered.map(r => (
            <div key={r.id} className="grid grid-cols-[140px_1fr_1fr_1fr] gap-3 px-4 py-3 row-hover items-start">
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
                {activityActorLabel(r.actor_id)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>admin_activity_feed()</code> · last 200 entries · amounts, names and descriptions are never shown
      </p>
    </div>
  );
}
