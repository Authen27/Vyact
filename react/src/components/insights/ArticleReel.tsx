// Vyact — the What's New tab's universal article viewer (v9.9.1).
// Mirrors EvergreenReel for the editorial/external content_items rows: an
// item with an admin-uploaded infographic shows it full-bleed portrait with
// Watch-video (if a short is linked) + Read actions; one without falls back
// to the original text-summary layout.
import { useEffect, useRef, useState } from 'react';
import { X, Heart, BookOpen, PlayCircle, Clock, ChevronUp } from 'lucide-react';
import FullScreenVideoOverlay from './FullScreenVideoOverlay';
import YouTubeShort from './YouTubeShort';
import type { InsightArticle } from '../../lib/insightsApi';

const TOPIC_COLOR: Record<InsightArticle['topic'], string> = {
  debt: 'text-terra bg-terra/10', tax: 'text-denim bg-denim/10',
  investment: 'text-honey bg-honey/15', budgeting: 'text-coral bg-coral-tint',
  savings: 'text-sage bg-sage/10', retirement: 'text-plum bg-plum/10',
};

interface Props {
  articles: InsightArticle[];
  startIndex?: number;
  onClose: () => void;
  favorites: Set<string>;
  onToggleFav: (a: InsightArticle) => void;
}

export default function ArticleReel({ articles, startIndex = 0, onClose, favorites, onToggleFav }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(startIndex);
  const [reading, setReading] = useState<InsightArticle | null>(null);
  const [watching, setWatching] = useState<InsightArticle | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    (scroller.current?.children[startIndex] as HTMLElement | undefined)?.scrollIntoView({ behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reading || watching) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = active + (e.key === 'ArrowDown' ? 1 : -1);
        (scroller.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose, reading, watching]);

  function onScroll() {
    const el = scroller.current;
    if (el) setActive(Math.round(el.scrollTop / el.clientHeight));
  }

  return (
    <div className="fixed inset-0 z-[190] bg-bg" role="dialog" aria-label="What's New" aria-modal="true">
      <button onClick={onClose} aria-label="Close"
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-ink/10 hover:bg-ink/20 text-ink flex items-center justify-center backdrop-blur-sm">
        <X size={20} />
      </button>
      <div className="absolute top-5 left-4 z-20 flex flex-col gap-1.5">
        {articles.map((_, i) => (
          <span key={i} className={`w-1 rounded-full transition-all ${i === active ? 'h-5 bg-coral' : 'h-2 bg-ink/20'}`} />
        ))}
      </div>

      <div ref={scroller} onScroll={onScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth" style={{ scrollbarWidth: 'none' }}>
        {articles.map((a, i) => {
          const isFav = favorites.has(a.id);
          return (
            <section key={a.id} className="h-full w-full snap-start relative overflow-hidden">
              {a.infographicUrl ? (
                <>
                  <img src={a.infographicUrl} alt={a.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-6 pt-20 pb-8">
                    <span className={`inline-block font-mono text-[0.55rem] tracking-wider uppercase px-2 py-0.5 rounded-full mb-2 ${TOPIC_COLOR[a.topic]}`}>{a.topic}</span>
                    <h2 className="display-italic text-2xl leading-tight text-white mb-4">{a.title}</h2>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {a.videoUrl && (
                        <button onClick={() => setWatching(a)} className="btn-primary inline-flex items-center gap-1.5">
                          <PlayCircle size={16} /> Watch video
                        </button>
                      )}
                      <button onClick={() => setReading(a)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-white/10 border border-white/30 text-white hover:bg-white/20 transition-colors">
                        <BookOpen size={15} /> Read article
                      </button>
                      <button onClick={() => onToggleFav(a)} aria-label={isFav ? 'Unfavorite' : 'Favorite'}
                        className={`w-11 h-11 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${isFav ? 'text-coral bg-coral-tint border-coral/40' : 'border-white/30 bg-white/10 text-white hover:bg-white/20'}`}>
                        <Heart size={17} className={isFav ? 'fill-current' : ''} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center px-7 text-center bg-gradient-to-b from-coral/10 via-bg to-bg">
                  <span className="text-5xl mb-4" aria-hidden>{a.coverEmoji}</span>
                  <span className={`inline-block font-mono text-[0.55rem] tracking-wider uppercase px-2 py-0.5 rounded-full mb-2 ${TOPIC_COLOR[a.topic]}`}>{a.topic}</span>
                  <h2 className="display-italic text-[1.8rem] leading-tight text-ink max-w-md">{a.title}</h2>
                  <p className="text-[0.95rem] text-ink-mid mt-3 max-w-sm leading-relaxed">{a.summary}</p>
                  <span className="font-mono text-[0.62rem] text-ink-dim mt-2"><Clock size={10} className="inline mr-1" />{a.readMinutes} min</span>

                  <div className="flex items-center gap-2.5 mt-6">
                    {a.videoUrl && (
                      <button onClick={() => setWatching(a)} className="btn-secondary inline-flex items-center gap-1.5"><PlayCircle size={15} /> Watch</button>
                    )}
                    <button onClick={() => setReading(a)} className="btn-primary inline-flex items-center gap-1.5"><BookOpen size={15} /> Read</button>
                    <button onClick={() => onToggleFav(a)} aria-label={isFav ? 'Unfavorite' : 'Favorite'}
                      className={`w-11 h-11 rounded-full border flex items-center justify-center transition-colors ${isFav ? 'text-coral bg-coral-tint border-coral/40' : 'border-line bg-bg2 text-ink-mid hover:text-coral hover:border-coral/40'}`}>
                      <Heart size={17} className={isFav ? 'fill-current' : ''} />
                    </button>
                  </div>
                </div>
              )}

              {i === 0 && articles.length > 1 && (
                <div className={`absolute inset-x-0 flex flex-col items-center animate-bounce pointer-events-none ${a.infographicUrl ? 'top-5 text-white/80' : 'bottom-7 text-ink-dim'}`}>
                  <ChevronUp size={18} className="rotate-180" />
                  <span className="font-mono text-[0.56rem] tracking-widest uppercase">Swipe up</span>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {reading && <ArticleReader article={reading} isFav={favorites.has(reading.id)} onToggleFav={() => onToggleFav(reading)} onClose={() => setReading(null)} />}
      {watching && watching.videoUrl && (
        <FullScreenVideoOverlay videoUrl={watching.videoUrl} title={watching.title} onClose={() => setWatching(null)} />
      )}
    </div>
  );
}

function ArticleReader({ article, isFav, onToggleFav, onClose }: {
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
              <div className="font-mono text-[0.6rem] tracking-wider uppercase text-ink-dim">{article.topic} · {article.readMinutes} min · {article.authorName}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onToggleFav} aria-label={isFav ? 'Unfavorite' : 'Favorite'}
              className={`p-2 rounded-md transition-colors ${isFav ? 'text-coral bg-coral-tint' : 'text-ink-dim hover:text-coral hover:bg-coral-tint'}`}>
              <Heart size={16} className={isFav ? 'fill-current' : ''} />
            </button>
            <button onClick={onClose} className="text-ink-dim hover:text-ink p-1" aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <div className="px-6 py-5">
          {article.videoUrl && (
            <div className="mb-4">
              <YouTubeShort videoUrl={article.videoUrl} title={article.title} />
            </div>
          )}
          {article.summary && <p className="text-[0.95rem] text-ink-mid italic mb-4 leading-relaxed border-l-2 border-coral pl-3">{article.summary}</p>}
          <div className="text-[0.92rem] text-ink leading-relaxed whitespace-pre-line">{article.body}</div>
        </div>
      </div>
    </div>
  );
}
