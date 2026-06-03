// Vyact v6.3 — Insights (consumer-facing readables / newsletters)
// Reads admin-authored content from public.content_items (published only).
// Per-user favorites in public.content_favorites — NOT household-scoped.
//
// Design intent (per product brief):
//   - Dynamic — refetches on mount; admin publishes appear on next visit
//   - Searchable — title, summary, body, topic
//   - Favoritable — user can ♡ articles for a personal reading list

import { useEffect, useMemo, useState } from 'react';
import { Search, Heart, BookOpen, Clock } from 'lucide-react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import SavedViewsBar from '../components/savedViews/SavedViewsBar';
import { isCloudEnabled } from '../lib/supabase';
import {
  listPublishedContent, listFavoriteIds,
  addFavorite, removeFavorite,
  type InsightArticle,
} from '../lib/insightsApi';

const TOPIC_COLOR: Record<InsightArticle['topic'], string> = {
  debt:       'text-terra bg-terra/10',
  tax:        'text-denim bg-denim/10',
  investment: 'text-honey bg-honey/15',
  budgeting:  'text-coral bg-coral-tint',
  savings:    'text-sage bg-sage/10',
  retirement: 'text-plum bg-plum/10',
};

const ALL_TOPICS = ['debt','tax','investment','budgeting','savings','retirement'] as const;

export default function Insights() {
  const { t } = useTranslation();
  const session = useStore(s => s.session);
  const cloudEnabled = useStore(s => s.cloudEnabled);
  const toast = useStore(s => s.toast);

  const [articles, setArticles] = useState<InsightArticle[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<'all' | InsightArticle['topic']>('all');
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [reading, setReading] = useState<InsightArticle | null>(null);

  useEffect(() => {
    if (!isCloudEnabled() || !session) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const [a, fav] = await Promise.all([listPublishedContent(), listFavoriteIds()]);
        if (cancelled) return;
        setArticles(a);
        setFavorites(fav);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  const filtered = useMemo(() => {
    let f = articles;
    if (topicFilter !== 'all') f = f.filter(a => a.topic === topicFilter);
    if (showFavOnly)           f = f.filter(a => favorites.has(a.id));
    if (query.trim()) {
      const q = query.toLowerCase();
      f = f.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.topic.toLowerCase().includes(q));
    }
    return f;
  }, [articles, topicFilter, showFavOnly, favorites, query]);

  async function toggleFav(a: InsightArticle) {
    const isFav = favorites.has(a.id);
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(a.id); else next.add(a.id);
      return next;
    });
    try {
      if (isFav) await removeFavorite(a.id);
      else       await addFavorite(a.id);
    } catch (e) {
      // rollback
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(a.id); else next.delete(a.id);
        return next;
      });
      toast(`Could not update favorite: ${(e as Error).message}`, 'error');
    }
  }

  // ── Local-only mode: insights require the cloud DB ─────────────────
  if (!cloudEnabled) {
    return (
      <div>
        <Header t={t} count={0} favCount={0} />
        <Panel>
          <div className="px-6 py-14 text-center">
            <div className="text-4xl mb-3 opacity-60">📰</div>
            <p className="text-ink-mid mb-2">Insights require cloud sync.</p>
            <p className="text-[0.84rem] text-ink-dim">
              Sign in with a cloud-enabled deployment to read articles published by the editorial team.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <Header t={t} count={articles.length} favCount={favorites.size} />

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search articles, topics, authors…"
            className="input w-full pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <FilterChip active={topicFilter === 'all'}      onClick={() => setTopicFilter('all')}>All topics</FilterChip>
          {ALL_TOPICS.map(t => (
            <FilterChip key={t} active={topicFilter === t} onClick={() => setTopicFilter(t)}>{t}</FilterChip>
          ))}
          <FilterChip active={showFavOnly} onClick={() => setShowFavOnly(v => !v)}>
            <Heart size={11} className={showFavOnly ? 'fill-current' : ''} /> Favorites
          </FilterChip>
        </div>
        <div className="ml-auto">
          <SavedViewsBar
            page="insights"
            filters={{ topicFilter, showFavOnly }}
            onApply={f => {
              if (typeof f.topicFilter === 'string') setTopicFilter(f.topicFilter as typeof topicFilter);
              else setTopicFilter('all');
              setShowFavOnly(Boolean(f.showFavOnly));
            }}
          />
        </div>
      </div>

      {/* Body */}
      {loading && (
        <Panel><div className="px-6 py-10 text-center text-ink-mid text-sm">Loading…</div></Panel>
      )}
      {error && (
        <Panel><div className="px-6 py-6 text-center text-terra text-sm">Could not load: {error}</div></Panel>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState icon="🔍" message={
          showFavOnly ? "No favorites yet — tap ♡ on an article to save it." :
          query ? `No articles match "${query}"` : "No articles published yet."
        } />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(a => {
          const isFav = favorites.has(a.id);
          return (
            <article key={a.id}
              className="bg-bg border border-line rounded-xl p-5 transition-shadow hover:shadow-md flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl" aria-hidden>{a.coverEmoji}</span>
                <button onClick={() => toggleFav(a)} aria-label={isFav ? 'Unfavorite' : 'Favorite'}
                  className={`p-1.5 rounded-md transition-colors ${
                    isFav ? 'text-coral bg-coral-tint' : 'text-ink-dim hover:text-coral hover:bg-coral-tint'
                  }`}>
                  <Heart size={14} className={isFav ? 'fill-current' : ''} />
                </button>
              </div>
              <span className={`inline-block self-start font-mono text-[0.55rem] tracking-wider uppercase px-2 py-0.5 rounded-full mb-2 ${TOPIC_COLOR[a.topic]}`}>
                {a.topic}
              </span>
              <h3 className="font-semibold text-ink text-[0.94rem] leading-snug mb-1.5">{a.title}</h3>
              <p className="text-[0.82rem] text-ink-mid leading-relaxed flex-1 mb-3">{a.summary}</p>
              <div className="flex items-center justify-between text-[0.72rem] text-ink-dim font-mono">
                <span><Clock size={10} className="inline mr-1" />{a.readMinutes} min</span>
                <button onClick={() => setReading(a)}
                  className="text-coral hover:underline tracking-wider uppercase text-[0.62rem]">
                  <BookOpen size={10} className="inline mr-1" /> Read →
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {reading && <ReaderModal article={reading} isFav={favorites.has(reading.id)} onToggleFav={() => toggleFav(reading)} onClose={() => setReading(null)} />}
    </div>
  );
}

function Header({ t, count, favCount }: { t: (k: string) => string; count: number; favCount: number }) {
  return (
    <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
      <div>
        <h1 className="display-italic text-4xl text-ink mb-1.5">{t('insights') || 'Insights'}</h1>
        <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
          {count} article{count === 1 ? '' : 's'} · {favCount} favorited · curated by Vyact editorial
        </p>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 font-mono text-[0.6rem] tracking-[0.12em] uppercase px-2.5 py-1.5 rounded-md border transition ${
        active
          ? 'bg-coral text-white border-coral'
          : 'bg-bg border-line text-ink-mid hover:border-line2 hover:text-ink'
      }`}>
      {children}
    </button>
  );
}

function ReaderModal({ article, isFav, onToggleFav, onClose }: {
  article: InsightArticle; isFav: boolean; onToggleFav: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5"
      style={{ background: 'hsl(var(--shadow) / 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-bg2 border border-line2 rounded-lg w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-3">
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-line">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-3xl flex-shrink-0">{article.coverEmoji}</span>
            <div className="min-w-0">
              <h2 className="display-italic text-2xl text-ink leading-tight mb-1">{article.title}</h2>
              <div className="font-mono text-[0.6rem] tracking-wider uppercase text-ink-dim">
                {article.topic} · {article.readMinutes} min · {article.authorName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onToggleFav} aria-label={isFav ? 'Unfavorite' : 'Favorite'}
              className={`p-2 rounded-md transition-colors ${
                isFav ? 'text-coral bg-coral-tint' : 'text-ink-dim hover:text-coral hover:bg-coral-tint'
              }`}>
              <Heart size={16} className={isFav ? 'fill-current' : ''} />
            </button>
            <button onClick={onClose} className="text-ink-dim hover:text-ink p-1">✕</button>
          </div>
        </div>
        <div className="px-6 py-5">
          {article.summary && (
            <p className="text-[0.95rem] text-ink-mid italic mb-4 leading-relaxed border-l-2 border-coral pl-3">
              {article.summary}
            </p>
          )}
          <div className="text-[0.92rem] text-ink leading-relaxed whitespace-pre-line">{article.body}</div>
        </div>
      </div>
    </div>
  );
}
