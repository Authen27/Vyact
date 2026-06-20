// Vyact Admin v8 — Content (real Supabase)
// Articles authored here surface in the consumer app at /insights for any
// authenticated user as soon as status='published'.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Eye, FileText, Trash2, GraduationCap, Link2 } from 'lucide-react';
import { useAdminStore } from '../store';
import {
  listAllContent, upsertContent, deleteContent, slugify,
  type ContentInput, type EnrichedContent, type ContentFormat, type VisualKind, type CardTone, type SourceName,
} from '../lib/contentApi';
import {
  ICON_ALLOWLIST, DIAGRAM_PRIMITIVES, VISUAL_KINDS, CARD_TONES, SOURCE_NAMES,
  CARD_CATEGORIES, topicForCategory, defaultVisualRef, type DiagramPrimitive,
} from '../lib/visualKit';
import CardVisualPreview from '../components/CardVisualPreview';
import type { Article, ContentStatus } from '../types';

const FORMAT_COLOR: Record<ContentFormat, string> = {
  article:  'bg-info/10 text-info',
  card:     'bg-claude/10 text-claude',
  external: 'bg-warn/10 text-warn',
};

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

type EnrichedArticle = EnrichedContent;

export default function Content() {
  const query   = useAdminStore(s => s.query);
  const session = useAdminStore(s => s.session);
  const [articles, setArticles] = useState<EnrichedArticle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContentStatus>('all');
  const [editing, setEditing]   = useState<EnrichedArticle | null>(null);
  const [formKind, setFormKind] = useState<ContentFormat | null>(null);

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
    cards:     articles.filter(a => a.format === 'card').length,
    published: articles.filter(a => a.status === 'published').length,
    review:    articles.filter(a => a.status === 'review').length,
    draft:     articles.filter(a => a.status === 'draft').length,
  }), [articles]);

  function openNew(kind: ContentFormat) { setEditing(null); setFormKind(kind); }
  function openEdit(a: EnrichedArticle)  { setEditing(a); setFormKind(a.format); }
  function closeForm() { setFormKind(null); setEditing(null); }
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
            {counts.total} items · {counts.cards} cards · {counts.published} published · live in the consumer Insights hub
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => openNew('article')}
            className="border border-line text-ink px-3 py-2 rounded-md font-medium text-[0.84rem] hover:bg-elev transition flex items-center gap-1.5">
            <FileText size={14} /> Article
          </button>
          <button onClick={() => openNew('external')}
            className="border border-line text-ink px-3 py-2 rounded-md font-medium text-[0.84rem] hover:bg-elev transition flex items-center gap-1.5">
            <Link2 size={14} /> External
          </button>
          <button onClick={() => openNew('card')}
            className="bg-claude text-white px-4 py-2 rounded-md font-medium text-[0.86rem] hover:bg-claude-2 transition flex items-center gap-1.5">
            <Plus size={14} /> New Card
          </button>
        </div>
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
              <div className="flex flex-col gap-1 items-start">
                <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${FORMAT_COLOR[a.format]}`}>
                  {a.format}
                </span>
                <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${TOPIC_COLOR[a.topic]}`}>
                  {a.format === 'card' && a.category ? a.category : a.topic}
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

      {formKind === 'article' && (
        <ArticleFormModal
          initial={editing}
          authorName={authorName(session)}
          onClose={closeForm}
          onSaved={() => { closeForm(); reload(); }}
        />
      )}
      {formKind === 'card' && (
        <CardFormModal
          initial={editing}
          authorName={authorName(session)}
          onClose={closeForm}
          onSaved={() => { closeForm(); reload(); }}
        />
      )}
      {formKind === 'external' && (
        <ExternalFormModal
          initial={editing}
          authorName={authorName(session)}
          onClose={closeForm}
          onSaved={() => { closeForm(); reload(); }}
        />
      )}
    </div>
  );
}

function authorName(session: { user?: { user_metadata?: { display_name?: string }; email?: string } } | null): string {
  return session?.user?.user_metadata?.display_name || session?.user?.email || 'Editorial';
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
  initial: EnrichedContent | null;
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

// ── Card authoring (format='card') ──────────────────────────────────────────
function CardFormModal({ initial, authorName, onClose, onSaved }: FormProps) {
  const [title, setTitle]       = useState(initial?.title ?? '');
  const [slug, setSlug]         = useState(initial?.slug ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? 'Saving');
  const [tone, setTone]         = useState<CardTone>(initial?.tone ?? 'neutral');
  const [bodyMd, setBodyMd]     = useState(initial?.bodyMd ?? '');
  const [tags, setTags]         = useState((initial?.tags ?? []).join(', '));
  const [readingSecs, setReadingSecs] = useState(String(initial?.readingSeconds ?? 30));
  const [india, setIndia]       = useState(initial?.indiaRelevant ?? false);
  const [status, setStatus]     = useState<ContentStatus>(initial?.status ?? 'draft');
  const [visualKind, setVisualKind] = useState<VisualKind>((initial?.visualKind as VisualKind) ?? 'icon');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visualRef, setVisualRef]   = useState<any>(initial?.visualRef ?? defaultVisualRef('icon'));
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const words = bodyMd.trim() ? bodyMd.trim().split(/\s+/).length : 0;

  function changeKind(k: VisualKind) {
    setVisualKind(k);
    setVisualRef(defaultVisualRef(k));
  }

  async function save() {
    setError(''); setSaving(true);
    try {
      const input: ContentInput = {
        id: initial?.id, format: 'card',
        slug: slug || slugify(title), title: title.trim(),
        topic: topicForCategory(category) as Article['topic'],
        status, author_name: authorName,
        category, tone, body_md: bodyMd,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        reading_seconds: parseInt(readingSecs) || 30,
        india_relevant: india,
        visual_kind: visualKind, visual_ref: visualRef,
      };
      if (!input.title || !input.body_md) throw new Error('Title and body are required');
      await upsertContent(input);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Edit card' : 'New evergreen card'} onClose={onClose}>
      <div className="grid sm:grid-cols-[1fr_160px] gap-4">
        <div className="space-y-3 min-w-0">
          <FormField label="Title">
            <input value={title} onChange={e => { setTitle(e.target.value); if (!initial) setSlug(slugify(e.target.value)); }} className={inp} />
          </FormField>
          <FormField label="Slug" hint="unique id">
            <input value={slug} onChange={e => setSlug(slugify(e.target.value))} className={`${inp} font-mono`} />
          </FormField>
          <FormField label="Body" hint={`${words} words · aim ≤120`}>
            <textarea value={bodyMd} onChange={e => setBodyMd(e.target.value)} rows={7} className={inp} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category">
              <select value={category} onChange={e => setCategory(e.target.value)} className={inp}>
                {CARD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Tone">
              <select value={tone} onChange={e => setTone(e.target.value as CardTone)} className={inp}>
                {CARD_TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Reading secs">
              <input type="number" min="10" max="300" value={readingSecs} onChange={e => setReadingSecs(e.target.value)} className={inp} />
            </FormField>
            <FormField label="Status">
              <select value={status} onChange={e => setStatus(e.target.value as ContentStatus)} className={inp}>
                {(['draft','review','published','archived'] as ContentStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Tags" hint="comma-separated — used for contextual surfacing">
            <input value={tags} onChange={e => setTags(e.target.value)} className={`${inp} font-mono`} placeholder="emergency_fund, runway, beginner" />
          </FormField>
          <label className="flex items-center gap-2 text-[0.8rem] text-ink-mid">
            <input type="checkbox" checked={india} onChange={e => setIndia(e.target.checked)} /> India-relevant
          </label>
        </div>

        {/* Visual picker + live preview (same renderer the consumer ships) */}
        <div className="space-y-2">
          <div className="mono-label">Visual</div>
          <CardVisualPreview kind={visualKind} ref_={visualRef} className="h-28 w-full" />
          <VisualPicker kind={visualKind} ref_={visualRef} onKind={changeKind} onRef={setVisualRef} />
        </div>
      </div>
      {error && <div className="text-danger text-[0.78rem] mt-3">{error}</div>}
      <ModalActions saving={saving} onClose={onClose} onSave={save} editing={!!initial} />
    </Modal>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VisualPicker({ kind, ref_, onKind, onRef }: { kind: VisualKind; ref_: any; onKind: (k: VisualKind) => void; onRef: (r: any) => void }) {
  const set = (patch: Record<string, unknown>) => onRef({ ...ref_, ...patch });
  const primitive: DiagramPrimitive = ref_?.primitive ?? 'arc';
  return (
    <div className="space-y-2">
      <select value={kind} onChange={e => onKind(e.target.value as VisualKind)} className={inpSm}>
        {VISUAL_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
      </select>

      {kind === 'icon' && (
        <select value={ref_?.icon ?? ''} onChange={e => onRef({ icon: e.target.value })} className={inpSm}>
          {ICON_ALLOWLIST.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      )}

      {kind === 'stat' && (
        <>
          <input value={ref_?.big ?? ''} onChange={e => set({ big: e.target.value })} placeholder="big (₹500/day)" className={inpSm} />
          <input value={ref_?.sub ?? ''} onChange={e => set({ sub: e.target.value })} placeholder="sub" className={inpSm} />
        </>
      )}

      {kind === 'diagram' && (
        <>
          <select value={primitive} onChange={e => onRef(defaultVisualRef('diagram', e.target.value as DiagramPrimitive))} className={inpSm}>
            {DIAGRAM_PRIMITIVES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {primitive === 'arc' && (
            <>
              <input type="number" min="0" max="100" value={ref_.pct} onChange={e => set({ pct: parseInt(e.target.value) || 0 })} placeholder="pct" className={inpSm} />
              <input value={ref_.label ?? ''} onChange={e => set({ label: e.target.value })} placeholder="label" className={inpSm} />
            </>
          )}
          {primitive === 'arrow' && (
            <>
              <select value={ref_.dir} onChange={e => set({ dir: e.target.value })} className={inpSm}><option value="up">up</option><option value="down">down</option></select>
              <input value={ref_.label ?? ''} onChange={e => set({ label: e.target.value })} placeholder="label" className={inpSm} />
            </>
          )}
          {primitive === 'compare2' && (
            <>
              <input value={ref_.a ?? ''} onChange={e => set({ a: e.target.value })} placeholder="A" className={inpSm} />
              <input value={ref_.b ?? ''} onChange={e => set({ b: e.target.value })} placeholder="B" className={inpSm} />
            </>
          )}
          {primitive === 'bar2' && (
            <>
              <input value={ref_.a?.[0] ?? ''} onChange={e => set({ a: [e.target.value, ref_.a?.[1] ?? 0] })} placeholder="A label" className={inpSm} />
              <input type="number" value={ref_.a?.[1] ?? 0} onChange={e => set({ a: [ref_.a?.[0] ?? '', parseInt(e.target.value) || 0] })} placeholder="A value" className={inpSm} />
              <input value={ref_.b?.[0] ?? ''} onChange={e => set({ b: [e.target.value, ref_.b?.[1] ?? 0] })} placeholder="B label" className={inpSm} />
              <input type="number" value={ref_.b?.[1] ?? 0} onChange={e => set({ b: [ref_.b?.[0] ?? '', parseInt(e.target.value) || 0] })} placeholder="B value" className={inpSm} />
            </>
          )}
          {primitive === 'stack' && (
            <textarea
              value={(ref_.parts ?? []).map((p: [string, number]) => `${p[0]}, ${p[1]}`).join('\n')}
              onChange={e => set({ parts: e.target.value.split('\n').map(l => l.split(',')).filter(a => a[0]?.trim()).map(a => [a[0].trim(), parseInt(a[1]) || 0]) })}
              rows={3} placeholder={'Needs, 50\nWants, 30\nSave, 20'} className={`${inpSm} font-mono`} />
          )}
        </>
      )}
    </div>
  );
}

// ── External curation (format='external') ────────────────────────────────────
function ExternalFormModal({ initial, authorName, onClose, onSaved }: FormProps) {
  const [title, setTitle]   = useState(initial?.title ?? '');
  const [sourceName, setSourceName] = useState<SourceName>(initial?.sourceName ?? 'RBI');
  const [sourceUrl, setSourceUrl]   = useState(initial?.sourceUrl ?? '');
  const [why, setWhy]       = useState(initial?.whyItMatters ?? '');
  const [tags, setTags]     = useState((initial?.tags ?? []).join(', '));
  const [topic, setTopic]   = useState<Article['topic']>(initial?.topic ?? 'budgeting');
  const [publishedAt, setPublishedAt] = useState((initial?.publishedAt ?? new Date().toISOString()).slice(0, 10));
  const [status, setStatus] = useState<ContentStatus>(initial?.status ?? 'published');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function save() {
    setError(''); setSaving(true);
    try {
      if (!title.trim() || !sourceUrl.trim()) throw new Error('Title and source URL are required');
      const input: ContentInput = {
        id: initial?.id, format: 'external',
        slug: initial?.slug || slugify(title), title: title.trim(), topic, status,
        author_name: authorName,
        source_name: sourceName, source_url: sourceUrl.trim(), why_it_matters: why.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        published_at: new Date(publishedAt + 'T12:00:00').toISOString(),
        summary: why.trim(),
      };
      await upsertContent(input);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Edit external item' : 'Curate external item'} onClose={onClose}>
      <div className="space-y-3">
        <FormField label="Title"><input value={title} onChange={e => setTitle(e.target.value)} className={inp} /></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Source" hint="allowlist">
            <select value={sourceName} onChange={e => setSourceName(e.target.value as SourceName)} className={inp}>
              {SOURCE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Published date" hint="drives ordering">
            <input type="date" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} className={inp} />
          </FormField>
        </div>
        <FormField label="Source URL" hint="we link out — never copy the body">
          <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://rbi.org.in/…" className={`${inp} font-mono`} />
        </FormField>
        <FormField label="Why it matters" hint="≤1 line, your own words">
          <input value={why} onChange={e => setWhy(e.target.value)} className={inp} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Topic">
            <select value={topic} onChange={e => setTopic(e.target.value as Article['topic'])} className={inp}>
              {(['debt','tax','investment','budgeting','savings','retirement'] as Article['topic'][]).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select value={status} onChange={e => setStatus(e.target.value as ContentStatus)} className={inp}>
              {(['draft','review','published','archived'] as ContentStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Tags" hint="who should see it"><input value={tags} onChange={e => setTags(e.target.value)} className={`${inp} font-mono`} placeholder="home_loan, rate_change" /></FormField>
      </div>
      {error && <div className="text-danger text-[0.78rem] mt-3">{error}</div>}
      <ModalActions saving={saving} onClose={onClose} onSave={save} editing={!!initial} />
    </Modal>
  );
}

// ── Shared modal chrome ──────────────────────────────────────────────────────
const inp = 'w-full bg-elev border border-line rounded-md px-3 py-2 text-[0.86rem] outline-none focus:border-claude';
const inpSm = 'w-full bg-elev border border-line rounded-md px-2 py-1.5 text-[0.8rem] outline-none focus:border-claude';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-surface border border-line2 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2">
        <div className="flex justify-between items-center px-5 py-4 border-b border-line">
          <h3 className="display-serif text-xl text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-dim hover:text-ink p-1">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ saving, onClose, onSave, editing }: { saving: boolean; onClose: () => void; onSave: () => void; editing: boolean }) {
  return (
    <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-line">
      <button onClick={onClose} className="font-mono text-[0.62rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition">Cancel</button>
      <button onClick={onSave} disabled={saving} className="bg-claude text-white px-4 py-2 rounded-md font-medium text-[0.86rem] hover:bg-claude-2 disabled:opacity-50 transition">
        {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
      </button>
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
