// Vyact — the transactional outbox (audit F6). Replaces the localStorage
// read-modify-write queue that could lose an op enqueued while a flush was
// in flight (flush snapshotted the queue, awaited network, then OVERWROTE the
// file with its own `remaining` list — erasing anything appended meanwhile).
//
// THE CONTRACT
//   • One durable row per operation (IndexedDB), keyed by a stable opId.
//   • Enqueue is an insert; it can never erase another op.
//   • A flush CLAIMS a batch (status + worker id + timestamp), performs the
//     cloud writes, and ACKs by opId — deleting exactly the rows that
//     succeeded. Ops enqueued during the flush are simply still there.
//   • A claim goes stale after CLAIM_STALE_MS, so a tab that dies mid-flush
//     doesn't hold its ops hostage from other tabs.
//   • Every op is stamped with its owner's uid. A flush claims only the
//     current user's ops (plus unowned/legacy ones), so on a shared device
//     user B's session never attempts — and dead-letters — user A's pending
//     writes (audit S5's "pending offline writes belonging to a previous
//     user" case). A's ops wait for A.
//   • Multi-tab serialisation lives in HybridAdapter via the Web Locks API;
//     this module stays storage-only and is fully testable in Node through
//     the memory driver.
//
// The legacy `sync_queue` localStorage key is migrated in once, then removed.

import ls from '../localStorageCompat';
import { uid } from '../format';
import { unexpected } from '../faults';
import type { QueueOp } from './types';

export interface StoredOp extends QueueOp {
  opId: string;
  seq: number;
  status: 'pending' | 'claimed';
  claimedBy?: string;
  claimedAt?: number;
  /** uid of the user who made the write; null = legacy/local-only. */
  ownerUid: string | null;
}

export interface OutboxDriver {
  put(op: StoredOp): Promise<void>;
  delete(opId: string): Promise<void>;
  getAll(): Promise<StoredOp[]>;
}

const CLAIM_STALE_MS = 60_000;
const LEGACY_KEY = 'sync_queue';

// ── IndexedDB driver (browser) ─────────────────────────────────────────────

const DB_NAME = 'vyact_outbox';
const STORE = 'ops';

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IdbDriver implements OutboxDriver {
  private dbp: Promise<IDBDatabase> | null = null;
  private db(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) {
            req.result.createObjectStore(STORE, { keyPath: 'opId' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      // A failed open (private mode, quota) must not wedge every later call.
      this.dbp.catch(() => { this.dbp = null; });
    }
    return this.dbp;
  }
  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.db();
    return db.transaction(STORE, mode).objectStore(STORE);
  }
  async put(op: StoredOp): Promise<void> {
    await idbRequest((await this.store('readwrite')).put(op));
  }
  async delete(opId: string): Promise<void> {
    await idbRequest((await this.store('readwrite')).delete(opId));
  }
  async getAll(): Promise<StoredOp[]> {
    return idbRequest((await this.store('readonly')).getAll()) as Promise<StoredOp[]>;
  }
}

// ── Memory driver (Node tests / non-IDB environments) ──────────────────────

export class MemoryDriver implements OutboxDriver {
  private map = new Map<string, StoredOp>();
  async put(op: StoredOp): Promise<void> { this.map.set(op.opId, op); }
  async delete(opId: string): Promise<void> { this.map.delete(opId); }
  async getAll(): Promise<StoredOp[]> { return [...this.map.values()]; }
}

// ── Module state (lazy — this module is imported at app boot) ──────────────

let driver: OutboxDriver | null = null;
let migrated = false;
let lastKnownCount = 0;

/** Test hook: inject a driver (null resets to the environment default). */
export function setDriverForTests(d: OutboxDriver | null): void {
  driver = d;
  migrated = false;
  lastKnownCount = 0;
}

function getDriver(): OutboxDriver {
  if (!driver) {
    driver = typeof indexedDB !== 'undefined' ? new IdbDriver() : new MemoryDriver();
  }
  return driver;
}

/** One-time import of the legacy localStorage queue. */
async function migrateLegacyOnce(): Promise<void> {
  if (migrated) return;
  migrated = true;
  let legacy: QueueOp[] = [];
  try { legacy = ls.readJson<QueueOp[]>(LEGACY_KEY) || []; } catch { legacy = []; }
  if (!legacy.length) return;
  const d = getDriver();
  const existing = await d.getAll();
  let seq = existing.reduce((m, o) => Math.max(m, o.seq), 0);
  for (const op of legacy) {
    seq += 1;
    // ownerUid unknown for legacy ops → null. They flush under the current
    // session; RLS rejects anything the current user may not write, and the
    // rejection dead-letters loudly rather than applying cross-user.
    await d.put({ ...op, opId: uid(), seq, status: 'pending', ownerUid: null });
  }
  try { ls.removeBoth(LEGACY_KEY); } catch { /* noop */ }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Append one durable op. Never modifies or removes another op. */
export async function enqueueOp(op: QueueOp, ownerUid: string | null): Promise<StoredOp> {
  try {
    await migrateLegacyOnce();
    const d = getDriver();
    const all = await d.getAll();
    const seq = all.reduce((m, o) => Math.max(m, o.seq), 0) + 1;
    const stored: StoredOp = { ...op, opId: uid(), seq, status: 'pending', ownerUid };
    await d.put(stored);
    lastKnownCount = all.length + 1;
    return stored;
  } catch (e) {
    // A failed enqueue is silent write-loss — the binding rule applies.
    unexpected(e, 'sync.outbox:enqueue');
    throw e;
  }
}

/**
 * Claim the due ops for one worker: pending (or stale-claimed), past their
 * backoff window, owned by this user (or unowned), oldest first.
 */
export async function claimDue(workerId: string, now: number, ownerUid: string | null): Promise<StoredOp[]> {
  await migrateLegacyOnce();
  const d = getDriver();
  const all = await d.getAll();
  const due = all
    .filter(o => o.ownerUid === ownerUid || o.ownerUid === null)
    .filter(o => o.status === 'pending' || (o.claimedAt ?? 0) < now - CLAIM_STALE_MS)
    .filter(o => !o.nextRetryAt || o.nextRetryAt <= now)
    .sort((a, b) => a.seq - b.seq);
  const claimed: StoredOp[] = [];
  for (const o of due) {
    const c: StoredOp = { ...o, status: 'claimed', claimedBy: workerId, claimedAt: now };
    await d.put(c);
    claimed.push(c);
  }
  lastKnownCount = all.length;
  return claimed;
}

/** Acknowledge a completed op — delete exactly that row. */
export async function ack(opId: string): Promise<void> {
  const d = getDriver();
  // Only a real deletion moves the badge count — acking a stale/unknown id
  // (e.g. an op another tab already acked) must not under-count the queue.
  const existed = (await d.getAll()).some(o => o.opId === opId);
  await d.delete(opId);
  if (existed) lastKnownCount = Math.max(0, lastKnownCount - 1);
}

/** Return a claimed op to pending with an updated backoff patch (retry). */
export async function release(op: StoredOp, patch: Partial<QueueOp>): Promise<void> {
  const { claimedBy: _c, claimedAt: _t, ...rest } = op;
  await getDriver().put({ ...rest, ...patch, status: 'pending' });
}

/** Re-add an op from a dead-letter bucket (R5 retry path). */
export async function requeueOp(op: QueueOp, ownerUid: string | null): Promise<void> {
  await enqueueOp(op, ownerUid);
}

/** Authoritative count (also refreshes the synchronous badge value). */
export async function pendingCount(ownerUid?: string | null): Promise<number> {
  await migrateLegacyOnce();
  const all = await getDriver().getAll();
  const n = ownerUid === undefined
    ? all.length
    : all.filter(o => o.ownerUid === ownerUid || o.ownerUid === null).length;
  lastKnownCount = n;
  return n;
}

/** Best-known synchronous count for UI badges; refreshed on every mutation. */
export function pendingCountSync(): number {
  return lastKnownCount;
}
