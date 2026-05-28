// TD-10 — sync queue visibility.
//
// Surfaces the HybridAdapter's queue + dead-letter state as a Sidebar
// badge. Cloud-mode-only: in local-mode (no `pendingOpCount` /
// `pendingConflictCount` methods on the adapter) the badge shows a
// neutral "Local" pill.
//
// State machine: Local · Offline · N Conflict(s) · Syncing · Synced.

import { useEffect, useState } from 'react';
import Badge from '../ui/Badge';
import { useStore } from '../../store';

interface ConflictAdapter {
  pendingOpCount?: () => number;
  pendingConflictCount?: () => number;
}

export default function SyncStatusBadge() {
  const adapter = useStore(s => s.adapter) as ConflictAdapter;
  const cloudEnabled = useStore(s => s.cloudEnabled);
  const [pendingOps, setPendingOps] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!cloudEnabled || !adapter) return;
    const tick = () => {
      const ops = typeof adapter.pendingOpCount === 'function' ? adapter.pendingOpCount() : 0;
      const conf = typeof adapter.pendingConflictCount === 'function' ? adapter.pendingConflictCount() : 0;
      setPendingOps(ops || 0);
      setConflicts(conf || 0);
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [adapter, cloudEnabled]);

  if (!cloudEnabled) {
    return (
      <div data-testid="sync-status-badge">
        <Badge tone="neutral">Local</Badge>
      </div>
    );
  }

  if (!online) {
    return (
      <div data-testid="sync-status-badge">
        <Badge tone="warn">Offline</Badge>
      </div>
    );
  }

  if (conflicts > 0) {
    return (
      <div data-testid="sync-status-badge">
        <Badge tone="alert">{conflicts} Conflict{conflicts > 1 ? 's' : ''}</Badge>
      </div>
    );
  }

  if (pendingOps > 0) {
    return (
      <div data-testid="sync-status-badge">
        <Badge tone="info">Syncing</Badge>
      </div>
    );
  }

  return (
    <div data-testid="sync-status-badge">
      <Badge tone="good">Synced</Badge>
    </div>
  );
}
