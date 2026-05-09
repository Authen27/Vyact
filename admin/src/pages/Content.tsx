import { useState, useMemo } from 'react';
import { Plus, Eye, FileText, ExternalLink } from 'lucide-react';
import { useAdminStore } from '../store';
import { MOCK_ARTICLES } from '../lib/mockData';
import type { Article, ContentStatus } from '../types';

const STATUS_COLOR: Record<ContentStatus, string> = {
  draft:     'bg-ink-dim/15 text-ink-dim',
  review:    'bg-warn/15 text-warn',
  published: 'bg-positive/15 text-positive',
  archived:  'bg-line2 text-ink-dim',
};

const TOPIC_COLOR: Record<Article['topic'], string> = {
  debt:       'bg-danger/10 text-danger',
  tax:        'bg-info/10 text-info',
  investment: 'bg-warn/10 text-warn',
  budgeting:  'bg-claude/10 text-claude',
  savings:    'bg-positive/10 text-positive',
  retirement: 'bg-tan/30 text-ink',
};

export default function Content() {
  const query = useAdminStore(s => s.query);
  const [statusFilter, setStatusFilter] = useState<'all' | ContentStatus>('all');

  const filtered = useMemo(() => {
    let f = [...MOCK_ARTICLES];
    if (statusFilter !== 'all') f = f.filter(a => a.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      f = f.filter(a => a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q) || a.topic.toLowerCase().includes(q));
    }
    return f;
  }, [query, statusFilter]);

  const counts = useMemo(() => ({
    total:     MOCK_ARTICLES.length,
    published: MOCK_ARTICLES.filter(a => a.status === 'published').length,
    review:    MOCK_ARTICLES.filter(a => a.status === 'review').length,
    draft:     MOCK_ARTICLES.filter(a => a.status === 'draft').length,
    views:     MOCK_ARTICLES.reduce((s, a) => s + a.views, 0),
  }), []);

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Content</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {counts.total} articles · {counts.published} published · {counts.views.toLocaleString()} total views
          </p>
        </div>
        <button className="bg-claude text-white px-4 py-2 rounded-md font-medium text-[0.86rem] hover:bg-claude-2 transition flex items-center gap-1.5">
          <Plus size={14} /> New Article
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="Total" value={counts.total} />
        <Metric label="Published" value={counts.published} tone="positive" />
        <Metric label="In review" value={counts.review} tone="warn" />
        <Metric label="Drafts" value={counts.draft} />
      </div>

      <div className="flex gap-2 mb-3">
        {(['all','draft','review','published','archived'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`font-mono text-[0.6rem] tracking-[0.12em] uppercase px-3 py-1.5 rounded-md border transition ${
              statusFilter === s ? 'bg-claude text-white border-claude' : 'bg-surface border-line text-ink-mid hover:border-line2 hover:text-ink'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr_60px] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>Title</div><div>Topic</div><div>Status</div><div>Author</div><div className="text-right">Views</div><div></div>
        </div>
        <div className="divide-y divide-line">
          {filtered.map(a => (
            <div key={a.id} className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr_60px] gap-3 px-4 py-3 row-hover items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <FileText size={12} className="text-ink-dim flex-shrink-0" />
                  <span className="text-[0.86rem] font-semibold text-ink truncate">{a.title}</span>
                  {a.source === 'aggregated' && <ExternalLink size={11} className="text-ink-dim flex-shrink-0" />}
                </div>
                <div className="font-mono text-[0.6rem] text-ink-dim">{a.slug}</div>
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${TOPIC_COLOR[a.topic]}`}>
                  {a.topic}
                </span>
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${STATUS_COLOR[a.status]}`}>
                  {a.status}
                </span>
              </div>
              <div className="font-mono text-[0.78rem] text-ink-mid truncate">{a.author}</div>
              <div className="text-right font-mono text-[0.78rem] text-ink-mid">
                {a.views > 0 ? a.views.toLocaleString() : '—'}
              </div>
              <div className="text-right">
                <button className="p-1 text-ink-mid hover:text-claude" title="Preview">
                  <Eye size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
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
