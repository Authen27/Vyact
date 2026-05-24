// FinFlow — TD-03 phase B
//
// Surfaces the HybridAdapter's dead-letter conflict bucket as an in-app
// banner. When another household member edits the same row concurrently,
// the adapter rejects our write (the `updated_at` precondition no longer
// matches), the op is moved to `ff_sync_conflicts`, and this banner tells
// the user — instead of failing silently.
//
// Behaviour:
//   • Polls `adapter.pendingConflictCount()` every 5 seconds. Cheap —
//     reads one localStorage key, parses an array length.
//   • Renders nothing when count === 0.
//   • Renders a small banner at the top of the main content area when
//     count > 0, with a "Dismiss" button that calls
//     `adapter.clearConflicts()`.
//   • Cloud-mode-only — the LocalStorageAdapter has no concurrency
//     surface and no conflict methods, so a typeof check guards both
//     calls. Local-mode users never see the banner.

import { useEffect, useState } from 'react';
import { useStore } from '../../store';

interface ConflictAdapter {
  pendingConflictCount?: () => number;
  clearConflicts?: () => void;
}

export default function SyncConflictBanner() {
  const adapter = useStore(s => s.adapter) as ConflictAdapter;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (typeof adapter?.pendingConflictCount !== 'function') return;
    const tick = () => setCount(adapter.pendingConflictCount!() || 0);
    tick();                                // initial read
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [adapter]);

  if (count === 0) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded border border-terra/40 bg-terra/10 px-4 py-3 text-sm text-ink"
      data-testid="sync-conflict-banner"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true">⚠️</span>
        <div className="flex-1">
          <div className="font-medium">
            {count} {count === 1 ? 'edit' : 'edits'} couldn’t be saved
          </div>
          <div className="mt-0.5 text-ink-mid">
            A household member edited the same item before you. Refresh the
            page to load their changes, then re-apply yours if needed.
          </div>
        </div>
        <button
          type="button"
          onClick={() => { adapter.clearConflicts?.(); setCount(0); }}
          className="shrink-0 rounded border border-ink/20 px-2 py-1 text-xs font-medium hover:bg-ink/5"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
