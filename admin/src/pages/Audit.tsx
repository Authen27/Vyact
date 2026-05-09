import { useMemo } from 'react';
import { Shield, Download } from 'lucide-react';
import { useAdminStore } from '../store';
import { MOCK_AUDIT } from '../lib/mockData';
import type { AdminRole } from '../types';

const ROLE_COLOR: Record<AdminRole, string> = {
  super:   'bg-claude/15 text-claude',
  roles:   'bg-info/15 text-info',
  content: 'bg-warn/15 text-warn',
};

export default function Audit() {
  const query = useAdminStore(s => s.query);

  const filtered = useMemo(() => {
    if (!query.trim()) return MOCK_AUDIT;
    const q = query.toLowerCase();
    return MOCK_AUDIT.filter(e =>
      e.action.toLowerCase().includes(q) ||
      e.actorEmail.toLowerCase().includes(q) ||
      e.entity.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1 flex items-center gap-2.5">
            <Shield className="text-claude" /> Audit Log
          </h1>
          <p className="text-ink-mid text-[0.92rem]">
            Immutable trail of every admin action · {filtered.length} entries
          </p>
        </div>
        <button className="px-4 py-2 border border-line bg-surface text-ink-mid rounded-md font-medium text-[0.86rem] hover:border-line2 hover:text-ink transition flex items-center gap-1.5">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_1.4fr_1fr_120px_120px] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>Time</div><div>Actor</div><div>Action</div><div>Entity</div><div>Role</div><div>IP</div>
        </div>
        <div className="divide-y divide-line max-h-[600px] overflow-y-auto">
          {filtered.map(e => {
            const t = new Date(e.at);
            return (
              <div key={e.id} className="grid grid-cols-[140px_1fr_1.4fr_1fr_120px_120px] gap-3 px-4 py-2.5 row-hover items-center">
                <div className="font-mono text-[0.7rem] text-ink-dim">
                  {t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="font-mono text-[0.78rem] text-ink-mid truncate">{e.actorEmail}</div>
                <div>
                  <code className="font-mono text-[0.78rem] text-claude bg-claude/5 px-1.5 py-0.5 rounded">{e.action}</code>
                </div>
                <div className="text-[0.78rem] text-ink-mid">
                  <span className="font-medium text-ink capitalize">{e.entity}</span>
                  {e.entityId && <span className="font-mono text-ink-dim ml-1.5">{e.entityId}</span>}
                </div>
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${ROLE_COLOR[e.actorRole]}`}>
                    {e.actorRole}
                  </span>
                </div>
                <div className="font-mono text-[0.7rem] text-ink-dim">{e.ip}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-center font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
        Read-only · Immutable · Retained 7 years (compliance)
      </div>
    </div>
  );
}
