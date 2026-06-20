// Vyact — "Learn" evergreen library tab (Insights Hub §4, v9.5.3).
// Searchable, category-filtered, favoritable browser over the bundled card
// library. Visuals render from code (CardVisual); favorites persist locally.
import { useEffect, useMemo, useState } from 'react';
import { Search, Heart, Clock, X } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import CardVisual from './CardVisual';
import {
  allEvergreenCards, filterEvergreen, readingChip, EVERGREEN_CATEGORIES,
  loadFavorites, saveFavorites, type EvergreenCard,
} from '../../lib/evergreen';

interface Props {
  /** When set, open this card's reader (deep-link from a For You nudge). */
  openId?: string | null;
  onConsumedOpen?: () => void;
}

export default function EvergreenLearn({ openId, onConsumedOpen }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | 'all'>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [reading, setReading] = useState<EvergreenCard | null>(null);

  // Honor a deep-link open request from the feed reel.
  useEffect(() => {
    if (!openId) return;
    const card = allEvergreenCards().find(c => c.id === openId);
    if (card) setReading(card);
    onConsumedOpen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function toggleFav(id: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveFavorites(next);
      return next;
    });
  }

  const cards = useMemo(() => {
    let f = filterEvergreen(query, category);
    if (favOnly) f = f.filter(c => favorites.has(c.id));
    return f;
  }, [query, category, favOnly, favorites]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search lessons — saving, EMI, SIP, runway…"
            aria-label="Search lessons"
            className="input w-full pl-9"
          />
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap mb-4">
        <Chip active={category === 'all'} onClick={() => setCategory('all')}>All</Chip>
        {EVERGREEN_CATEGORIES.map(c => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
        ))}
        <Chip active={favOnly} onClick={() => setFavOnly(v => !v)}>
          <Heart size={11} className={favOnly ? 'fill-current' : ''} /> Saved
        </Chip>
      </div>

      {cards.length === 0 ? (
        <EmptyState icon="🔍" message={favOnly ? 'No saved lessons yet — tap ♡ on a card.' : `No lessons match "${query}"`} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map(c => (
            <article key={c.id} className="bg-bg border border-line rounded-xl p-3 flex flex-col hover:shadow-md transition-shadow">
              <button onClick={() => setReading(c)} className="text-left" aria-label={`Read: ${c.title}`}>
                <CardVisual card={c} className="h-28 mb-3" />
                <span className="font-mono text-[0.55rem] tracking-wider uppercase text-ink-dim">{c.category}</span>
                <h3 className="font-semibold text-ink text-[0.92rem] leading-snug mt-0.5 mb-2">{c.title}</h3>
              </button>
              <div className="mt-auto flex items-center justify-between">
                <span className="font-mono text-[0.62rem] text-ink-dim"><Clock size={10} className="inline mr-1" />{readingChip(c.reading_seconds)}</span>
                <button onClick={() => toggleFav(c.id)} aria-label={favorites.has(c.id) ? 'Unsave' : 'Save'}
                  className={`p-1.5 rounded-md transition-colors ${favorites.has(c.id) ? 'text-coral bg-coral-tint' : 'text-ink-dim hover:text-coral hover:bg-coral-tint'}`}>
                  <Heart size={14} className={favorites.has(c.id) ? 'fill-current' : ''} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {reading && (
        <Reader card={reading} isFav={favorites.has(reading.id)} onToggleFav={() => toggleFav(reading.id)} onClose={() => setReading(null)} />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 font-mono text-[0.6rem] tracking-[0.12em] uppercase px-2.5 py-1.5 rounded-md border transition ${
        active ? 'bg-coral text-white border-coral' : 'bg-bg border-line text-ink-mid hover:border-line2 hover:text-ink'}`}>
      {children}
    </button>
  );
}

function Reader({ card, isFav, onToggleFav, onClose }: {
  card: EvergreenCard; isFav: boolean; onToggleFav: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The bodies are plain prose with blank-line paragraph breaks.
  const paragraphs = card.body_md.split(/\n\n+/);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'hsl(var(--shadow) / 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-bg2 border border-line2 rounded-lg w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-3">
        <div className="px-5 pt-5">
          <CardVisual card={card} className="h-36" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <span className="font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim">{card.category} · {readingChip(card.reading_seconds)}</span>
            <h2 className="display-italic text-2xl text-ink leading-tight mt-0.5">{card.title}</h2>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={onToggleFav} aria-label={isFav ? 'Unsave' : 'Save'}
              className={`p-2 rounded-md transition-colors ${isFav ? 'text-coral bg-coral-tint' : 'text-ink-dim hover:text-coral hover:bg-coral-tint'}`}>
              <Heart size={16} className={isFav ? 'fill-current' : ''} />
            </button>
            <button onClick={onClose} className="text-ink-dim hover:text-ink p-1.5" aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[0.92rem] text-ink leading-relaxed">{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
