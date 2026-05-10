// FinFlow Admin v8 — Content (real Supabase)
// Articles authored here surface in the consumer app at /insights for any
// authenticated user as soon as status='published'.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Eye, FileText, Trash2 } from 'lucide-react';
import { useAdminStore } from '../store';
import { listAllContent, upsertContent, deleteContent, slugify, type ContentInput } from '../lib/contentApi';
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

const TOPICS: Article['topic'][] = ['debt','tax','investment','budgeting','savings','retirement'];
const STATUSES: ContentStatus[]  = ['draft','review','published','archived'];

type EnrichedArticle = Article & { summary: string; body: string; readMinutes: number; coverEmoji: string };

export default function Content() {
  const query   = useAdminStore(s => s.query);
  const session = useAdminStore(s => s.session);
  const [articles, setArticles] = useState<EnrichedArticle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContentStatus>('all');
  const [editing, setEditing]   = useState<EnrichedArticle | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setLoading(true); setError('');
    try { setArticles(await listAllContent() as EnrichedArticle[]); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    let f = [...articles];
    if (statusFilter !== 'all') f = f.filter(a => a.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      f = f.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        a.topic.toLowerCase().includes(q));
    }
    return f;
  }, [articles, query, statusFilter]);

  const counts = useMemo(() => ({
    total:     articles.length,
    published: articles.filter(a => a.status === 'published').length,
    review:    articles.filter(a => a.status === 'review').length,
    draft:     articles.filter(a => a.status === 'draft').length,
  }), [articles]);

  function openNew()  { setEditing(null);  setShowForm(true); }
  function openEdit(a: EnrichedArticle) { setEditing(a); setShowForm(true); }
  async function handleDelete(a: EnrichedArticle) {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    try { await deleteContent(a.id); await reload(); }
    catch (e) { alert(`Delete failed: ${(e as Error).message}`); }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Content</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {counts.total} articles · {counts.published} published · live in consumer app at /insights
          </p>
        </div>
        <button onClick={openNew}
          className="bg-claude text-white px-4 py-2 rounded-md font-medium text-[0.86rem] hover:bg-claude-2 transition flex items-center gap-1.5">
          <Plus size={14} /> New Article
        </button>
      </div>

      {error && (
        <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="Total"      value={counts.total} />
        <Metric label="Published"  value={counts.published} tone="positive" />
        <Metric label="In review"  value={counts.review} tone="warn" />
        <Metric label="Drafts"     value={counts.draft} />
      </div>

      <div className="flex gap-2 mb-3">
        {(['all','draft','review','published','archived'] as const).map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`font-mono text-[0.6rem] tracking-[0.12em] uppercase px-3 py-1.5 rounded-md border transition ${
              statusFilter === s
                ? 'bg-claude text-white border-claude'
                : 'bg-surface border-line text-ink-mid hover:border-line2 hover:text-ink'
            }`}>{s}</button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[3fr_1fr_1fr_1fr_120px] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>Title</div><div>Topic</div><div>Status</div><div>Author</div><div className="text-right">Actions</div>
        </div>
        <div className="divide-y divide-line">
          {loading && <div className="px-4 py-6 text-center text-ink-mid text-sm">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-ink-mid text-sm">
              No articles. Click "New Article" to create the first one.
            </div>
          )}
          {filtered.map(a => (
            <div key={a.id} className="grid grid-cols-[3fr_1fr_1fr_1fr_120px] gap-3 px-4 py-3 row-hover items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-base flex-shrink-0">{a.coverEmoji}</span>
                  <span className="text-[0.86rem] font-semibold text-ink truncate">{a.title}</span>
                </div>
                <div className="font-mono text-[0.6rem] text-ink-dim truncate">{a.slug}</div>
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
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => openEdit(a)}
                  className="p-1.5 text-ink-mid hover:text-claude" title="Edit">
                  <FileText size={13} />
                </button>
                {a.status === 'published' && (
                  <a href={`/insights/${a.slug}`} target="_blank" rel="noreferrer"
                    className="p-1.5 text-ink-mid hover:text-claude" title="Preview on consumer app">
                    <Eye size={13} />
                  </a>
                )}
                <button onClick={() => handleDelete(a)}
                  className="p-1.5 text-ink-mid hover:text-danger" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <ArticleFormModal
          initial={editing}
          authorName={session?.user?.user_metadata?.display_name || session?.user?.email || 'Editorial'}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); reload(); }}
        />
      )}
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

interface FormProps {
  initial: (Article & { summary: string; body: string; readMinutes: number; coverEmoji: string }) | null;
  authorName: string;
  onClose: () => void;
  onSaved: () => void;
}

function ArticleFormModal({ initial, authorName, onClose, onSaved }: FormProps) {
  const [title,    setTitle]    = useState(initial?.title  ?? '');
  const [slug,     setSlug]     = useState(initial?.slug   ?? '');
  const [summary,  setSummary]  = useState(initial?.summary ?? '');
  const [body,     setBody]     = useState(initial?.body   ?? '');
  const [topic,    setTopic]    = useState<Article['topic']>(initial?.topic ?? 'budgeting');
  const [status,   setStatus]   = useState<ContentStatus>(initial?.status ?? 'draft');
  const [readMin,  setReadMin]  = useState(String(initial?.readMinutes ?? 3));
  const [emoji,    setEmoji]    = useState(initial?.coverEmoji ?? '📰');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function save() {
    setError(''); setSaving(true);
    try {
      const input: ContentInput = {
        id: initial?.id,
        slug: slug || slugify(title),
        title: title.trim(),
        summary,
        body,
        topic,
        status,
        read_minutes: parseInt(readMin) || 3,
        cover_emoji: emoji,
        author_name: authorName,
      };
      if (!input.title || !input.body) throw new Error('Title and body are required');
      await upsertContent(input);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-surface border border-line2 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2">
        <div className="flex justify-between items-center px-5 py-4 border-b border-line">
          <h3 className="display-serif text-xl text-ink">{initial ? 'Edit article' : 'New article'}</h3>
          <button onClick={onClose} className="text-ink-dim hover:text-ink p-1">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <FormField label="Title">
            <input value={title}
              onChange={e => { setTitle(e.target.value); if (!initial) setSlug(slugify(e.target.value)); }}
              className="w-full bg-elev border border-line rounded-md px-3 py-2 text-[0.86rem] outline-none focus:border-claude" />
          </FormField>
          <FormField label="Slug" hint="auto-generated from title; you can edit">
            <input value={slug} onChange={e => setSlug(slugify(e.target.value))}
              className="w-full bg-elev border border-line rounded-md px-3 py-2 text-[0.86rem] font-mono outline-none focus:border-claude" />
          </FormField>
          <FormField label="Summary" hint="1 sentence shown on the consumer card">
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2}
              className="w-full bg-elev border border-line rounded-md px-3 py-2 text-[0.86rem] outline-none focus:border-claude" />
          </FormField>
          <FormField label="Body">
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
              className="w-full bg-elev border border-line rounded-md px-3 py-2 text-[0.86rem] leading-relaxed outline-none focus:border-claude" />
          </FormField>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Topic">
              <select value={topic} onChange={e => setTopic(e.target.value as Article['topic'])}
                className="w-full bg-elev border border-line rounded-md px-2 py-2 text-[0.84rem] outline-none focus:border-claude">
                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={status} onChange={e => setStatus(e.target.value as ContentStatus)}
                className="w-full bg-elev border border-line rounded-md px-2 py-2 text-[0.84rem] outline-none focus:border-claude">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Read mins">
              <input type="number" min="1" max="60" value={readMin} onChange={e => setReadMin(e.target.value)}
                className="w-full bg-elev border border-line rounded-md px-2 py-2 text-[0.84rem] outline-none focus:border-claude" />
            </FormField>
            <FormField label="Cover emoji">
              <input value={emoji} onChange={e => setEmoji(e.target.value.slice(0, 4))} maxLength={4}
                className="w-full bg-elev border border-line rounded-md px-2 py-2 text-[0.86rem] text-center outline-none focus:border-claude" />
            </FormField>
          </div>

          {error && <div className="text-danger text-[0.78rem]">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose}
            className="font-mono text-[0.62rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="bg-claude text-white px-4 py-2 rounded-md font-medium text-[0.86rem] hover:bg-claude-2 disabled:opacity-50 transition">
            {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-ink-mid mb-1.5 block">
        {label}{hint && <span className="text-ink-dim normal-case ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
