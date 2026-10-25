// v1.5.0 (ADM-08): previous / next over a server-paged list.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE } from '../lib/adminApi';

export default function Pager({ offset, total, onPage }: { offset: number; total: number; onPage: (o: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const from = offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  return (
    <div className="mt-3 flex items-center justify-end gap-2 font-mono text-[0.68rem] text-ink-mid">
      <span>{from}–{to} of {total}</span>
      <button type="button" aria-label="Previous page" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - PAGE_SIZE))}
        className="p-1 border border-line rounded disabled:opacity-40"><ChevronLeft size={12} /></button>
      <button type="button" aria-label="Next page" disabled={to >= total} onClick={() => onPage(offset + PAGE_SIZE)}
        className="p-1 border border-line rounded disabled:opacity-40"><ChevronRight size={12} /></button>
    </div>
  );
}
