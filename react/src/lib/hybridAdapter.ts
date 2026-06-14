// Vyact v4.1 — HybridAdapter
// Reads-from-cache-first / writes-go-to-both pattern.
//   • Render path: instant paint from LocalStorage cache
//   • Background: refresh cache from Supabase
//   • Writes: optimistic local + queue + flush to cloud
//   • Offline: queue persists; flushes on reconnect
//
// This is the production adapter. SupabaseAdapter alone works but blocks the
// UI on every read; HybridAdapter is what FinFlow ships with.

import type {
  Profile, ExchangeRates, HouseholdMeta, ProfileTypeKey,
} from '../types';
import {
  type DataAdapter, type Entity, LocalStorageAdapter,
} from './dataAdapter';
import ls from './localStorageCompat';
import { SupabaseAdapter, ConcurrencyConflictError } from './supabaseAdapter';
import type { SupabaseClient } from '@supabase/supabase-js';

interface QueueOp {
  ts: number;
  op: 'upsert' | 'remove' | 'replaceAll' | 'updateProfile' | 'upsertRate';
  entity?: Entity;
  householdId: string;
  payload?: unknown;
  id?: string;
  code?: string;
  rate?: number;
  /**
   * TD-03 (PR #11) — when set, the upsert is performed as a guarded
   * UPDATE (`WHERE id = ? AND updated_at = expectedUpdatedAt`). If the
   * cloud row has been touched since the caller's read, the op is moved
  * to `vt_sync_conflicts` (compat: legacy `sync_conflicts`) instead of being
  * silently dropped or retried.
   */
  expectedUpdatedAt?: string;
  /**
   * TD-10 (2026-06-01) — bounded retry. Transient failures (network blip,
   * 5xx) re-queue with an exponential backoff (`nextRetryAt`) and a hard
   * cap (`MAX_RETRIES`). Past the cap the op is moved to the
   * `vt_sync_failed` dead-letter bucket so it stops jamming flushes.
   */
  attempts?: number;
  nextRetryAt?: number;
}

const MAX_RETRIES = 5;
// Exponential backoff in ms: 2s, 4s, 8s, 16s, 32s.
function backoffMs(attempts: number): number {
  return Math.min(60_000, 1000 * 2 ** attempts);
}

// queue/conflict keys are managed via localStorageCompat helper (vt_ / legacy prefix)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A queued op is syncable only if any id it carries is a valid UUID (cloud PK
// columns are uuid). Ops without an id (updateProfile, upsertRate, replaceAll)
// are always allowed; the entity-row ops (upsert/remove) must carry a UUID.
function isQueueOpIdValid(op: QueueOp): boolean {
  if (op.op === 'remove') return typeof op.id === 'string' && UUID_RE.test(op.id);
  if (op.op === 'upsert') {
    const id = (op.payload as { id?: string } | undefined)?.id;
    return typeof id === 'string' && UUID_RE.test(id);
  }
  return true;
}

export class HybridAdapter implements DataAdapter {
  cache: LocalStorageAdapter;
  cloud: SupabaseAdapter;
  private flushing = false;

  constructor(client: SupabaseClient) {
    this.cache = new LocalStorageAdapter();
    this.cloud = new SupabaseAdapter(client);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.flushQueue(); });
    }
  }

  // ── Read path: cache first, then refresh in background ─────
  // v6.4: A previous implementation unconditionally replaced the local cache
  // with whatever the cloud returned. If the cloud returned [] for any
  // reason — transient RLS hiccup, schema not deployed, momentary empty
  // response, network glitch surfacing as 200 — the local cache (and thus
  // every page in the app on the next refresh) was wiped. That was the root
  // cause of "data lost on refresh / sign-out → sign-in".
  //
  // Rules now:
  //   1. Cloud throws  → leave cache untouched.
  //   2. Cloud returns non-empty → replace cache, mark sentinel as synced.
  //   3. Cloud returns [] AND we have prior cache rows AND we have NOT yet
  //      observed a non-empty success for this (hid, entity) → treat as
  //      transient, leave cache untouched. A "force resync" can override.
  //   4. Cloud returns [] AND sentinel says we've synced before → trust the
  //      empty (the user really did delete everything) and clear cache.
  async list<T = unknown>(entity: Entity, householdId: string): Promise<T[]> {
    const cached = await this.cache.list<T>(entity, householdId);
    // TD-06: prefer the incremental path once we have a cursor. The cursor
    // is only set after a successful full pull, so the first sync per
    // (hid, entity) still goes through `list()` and replaces the cache
    // wholesale (preserving the v6.4 no-clobber semantics).
    const cursor = entity === 'members' ? null : this.readCursor(entity, householdId);
    // v7.0.2: Cold-start await. On the very first login on a fresh device
    // the cache is empty AND we've never recorded a sync sentinel. The
    // previous fire-and-forget path returned [] immediately, the store
    // settled to empty, and the dashboard rendered blank — only a manual
    // refresh picked up the cloud rows that landed milliseconds later in
    // the cache. We now await the initial pull in that one case so the
    // first paint already has data. Returning users still get the snappy
    // stale-while-revalidate behaviour because `hasSynced` is true for them.
    const coldStart = !cursor && cached.length === 0 && !this.hasSynced(entity, householdId);
    if (coldStart) {
      try {
        const fresh = await this.cloud.list<T>(entity, householdId);
        await this.applyCloudList(entity, householdId, cached as unknown[], fresh as unknown[]);
        return await this.cache.list<T>(entity, householdId);
      } catch {
        // Network error on first load — fall through to cached []. The
        // user sees an empty state instead of a hang; next refresh retries.
        return cached;
      }
    }
    if (cursor) {
      this.cloud.listSince(entity as Exclude<Entity, 'members'>, householdId, cursor)
        .then(delta => this.applyCloudDelta(entity, householdId, delta))
        .catch(() => {/* network error — cache stays */});
    } else {
      this.cloud.list<T>(entity, householdId)
        .then(fresh => this.applyCloudList(entity, householdId, cached as unknown[], fresh as unknown[]))
        .catch(() => {/* network error — cache stays */});
    }
    return cached;
  }

  private hasSynced(entity: Entity, householdId: string): boolean {
    try {
      return ls.readString(`cloud_synced_${householdId}_${entity}`) === '1';
    } catch { return false; }
  }
  private markSynced(entity: Entity, householdId: string): void {
    try { ls.setString(`cloud_synced_${householdId}_${entity}`, '1'); } catch { /* noop */ }
  }
  private async applyCloudList(entity: Entity, householdId: string, cached: unknown[], fresh: unknown[]): Promise<void> {
    if (fresh.length > 0) {
      await this.cache.replaceAll(entity, householdId, fresh);
      this.markSynced(entity, householdId);
      // TD-06: seed the delta-sync cursor with the max(updated_at) of the
      // freshly pulled page so the next refresh can skip straight to a
      // bounded `updated_at > cursor` query.
      if (entity !== 'members') this.seedCursorFromRows(entity, householdId, fresh);
      return;
    }
    // fresh is empty
    if (cached.length === 0 || this.hasSynced(entity, householdId)) {
      // Either the cache was already empty (no-op) or we trust this empty.
      await this.cache.replaceAll(entity, householdId, fresh);
      this.markSynced(entity, householdId);
      return;
    }
    // Defensive: cached has data, we've never seen a non-empty cloud
    // response for this (hid, entity). Treat as transient, keep cache.
    if (typeof console !== 'undefined') {
      console.warn(`[Vyact sync] Empty cloud response for ${entity}@${householdId}; keeping ${cached.length} cached rows. Use forceFullResync to override.`);
    }
  }

  // TD-06 cursor plumbing. The cursor is the largest `updated_at` we've
  // already merged into the local cache for this (hid, entity). Stored
  // per-device so each tab/browser drives its own incremental pull.
  private cursorKey(entity: Entity, householdId: string): string {
    return `cursor_${householdId}_${entity}`;
  }
  private readCursor(entity: Entity, householdId: string): string | null {
    try { return ls.readString(this.cursorKey(entity, householdId)) || null; } catch { return null; }
  }
  private writeCursor(entity: Entity, householdId: string, value: string): void {
    try { ls.setString(this.cursorKey(entity, householdId), value); } catch { /* noop */ }
  }
  private seedCursorFromRows(entity: Entity, householdId: string, rows: unknown[]): void {
    let max: string | null = null;
    for (const r of rows) {
      const u = (r as { updated_at?: string } | null)?.updated_at;
      if (u && (!max || u > max)) max = u;
    }
    if (max) this.writeCursor(entity, householdId, max);
  }

  private async applyCloudDelta(
    entity: Entity,
    householdId: string,
    delta: { rows: unknown[]; tombstones: string[]; maxUpdatedAt: string | null },
  ): Promise<void> {
    // Empty delta is the steady-state happy path — nothing changed since the
    // cursor. No cache touch, no cursor bump.
    if (delta.rows.length === 0 && delta.tombstones.length === 0) return;
    for (const row of delta.rows) {
      const r = row as { id?: string };
      if (!r.id) continue;
      await this.cache.upsert(entity, householdId, r as { id: string });
    }
    for (const id of delta.tombstones) {
      try { await this.cache.remove(entity, householdId, id); } catch { /* row may already be gone */ }
    }
    if (delta.maxUpdatedAt) this.writeCursor(entity, householdId, delta.maxUpdatedAt);
  }

  /** Clear the synced sentinel for a household so the next list() treats
   *  empty cloud responses as transient again. Call when you suspect
   *  cache corruption or want to re-trust the cloud. */
  forceFullResync(householdId: string): void {
    const entities: Entity[] = ['transactions','budgets','goals','debts','assets','members','accounts','savedViews','recurring','budgetAllocations'];
    for (const e of entities) {
      try { ls.removeBoth(`cloud_synced_${householdId}_${e}`); } catch { /* noop */ }
      // TD-06: also drop the delta-sync cursor so the next list() refills it.
      try { ls.removeBoth(`cursor_${householdId}_${e}`); } catch { /* noop */ }
    }
  }

  // ── Write path: cache + queue + try flush ──────────────────
  async upsert<T extends { id?: string }>(entity: Entity, householdId: string, record: T, expectedUpdatedAt?: string): Promise<T & { id: string }> {
    // The cache write always succeeds — it's per-tab and not subject to
    // cross-user concurrency. The version precondition only applies to
    // the cloud leg, which is queued and flushed below.
    const local = await this.cache.upsert(entity, householdId, record);
    this.enqueue({ ts: Date.now(), op: 'upsert', entity, householdId, payload: local, expectedUpdatedAt });
    this.flushQueue();
    return local;
  }
  async remove(entity: Entity, householdId: string, id: string): Promise<void> {
    await this.cache.remove(entity, householdId, id);
    this.enqueue({ ts: Date.now(), op: 'remove', entity, householdId, id });
    this.flushQueue();
  }
  async replaceAll<T = unknown>(entity: Entity, householdId: string, records: T[]): Promise<T[]> {
    await this.cache.replaceAll(entity, householdId, records);
    this.enqueue({ ts: Date.now(), op: 'replaceAll', entity, householdId, payload: records });
    this.flushQueue();
    return records;
  }
  async upsertRate(householdId: string, code: string, rate: number): Promise<void> {
    await this.cache.upsertRate(householdId, code, rate);
    this.enqueue({ ts: Date.now(), op: 'upsertRate', householdId, code, rate });
    this.flushQueue();
  }

  // Profile is per-user in cloud; cache it locally per-household for parity.
  async updateProfile(householdId: string, patch: Partial<Profile>): Promise<Profile> {
    await this.cache.updateProfile(householdId, patch);
    this.enqueue({ ts: Date.now(), op: 'updateProfile', householdId, payload: patch });
    this.flushQueue();
    return (await this.getProfile(householdId))!;
  }
  async getProfile(householdId: string): Promise<Profile | null> {
    // Try cloud first for source of truth, fall back to cache
    try {
      const cloud = await this.cloud.getProfile(householdId);
      if (cloud) {
        await this.cache.updateProfile(householdId, cloud);
        return cloud;
      }
    } catch { /* offline — use cache */ }
    return this.cache.getProfile(householdId);
  }
  async getRates(householdId: string): Promise<ExchangeRates> {
    try {
      const cloud = await this.cloud.getRates(householdId);
      // Hydrate local cache
      for (const [code, rate] of Object.entries(cloud)) {
        await this.cache.upsertRate(householdId, code, rate);
      }
      return await this.cache.getRates(householdId);
    } catch {
      return this.cache.getRates(householdId);
    }
  }

  // v7.3 — pre-aggregated breakouts. Forward to cloud only; the cache is
  // raw txns, so callers fold client-side when these throw / undefined.
  async queryTxnByMember(householdId: string) {
    if (!this.cloud.queryTxnByMember) return undefined;
    try { return await this.cloud.queryTxnByMember(householdId); }
    catch { return undefined; }
  }
  async queryTxnByAccount(householdId: string) {
    if (!this.cloud.queryTxnByAccount) return undefined;
    try { return await this.cloud.queryTxnByAccount(householdId); }
    catch { return undefined; }
  }

  // ── Households: cloud is source of truth ───────────────────
  async listHouseholds(): Promise<HouseholdMeta[]> {
    try {
      const cloud = await this.cloud.listHouseholds();
      try { ls.setJson('cloud_households', cloud); } catch { /* noop */ }
      return cloud;
    } catch {
      try { return ls.readJson<HouseholdMeta[]>('cloud_households') || []; }
      catch { return []; }
    }
  }
  async createHousehold(name: string, type: ProfileTypeKey, baseCurrency = 'USD'): Promise<HouseholdMeta> {
    const created = await this.cloud.createHousehold(name, type, baseCurrency);
    const list = await this.listHouseholds();
    ls.setJson('cloud_households', [...list, created]);
    return created;
  }
  async updateHousehold(id: string, patch: Partial<HouseholdMeta>): Promise<HouseholdMeta> {
    return this.cloud.updateHousehold(id, patch);
  }
  async deleteHousehold(id: string): Promise<void> {
    return this.cloud.deleteHousehold(id);
  }
  async getActiveHousehold(): Promise<string> {
    return this.cloud.getActiveHousehold();
  }
  async setActiveHousehold(id: string): Promise<string> {
    return this.cloud.setActiveHousehold(id);
  }

  // ── Queue management ───────────────────────────────────────
  private enqueue(op: QueueOp): void {
    const queue = this.readQueue();
    queue.push(op);
    this.writeQueue(queue);
  }
  private readQueue(): QueueOp[] {
    try {
      return ls.readJson<QueueOp[]>('sync_queue') || [];
    } catch { return []; }
  }
  private writeQueue(q: QueueOp[]): void {
    try { ls.setJson('sync_queue', q); } catch { /* noop */ }
  }

  async flushQueue(): Promise<void> {
    if (this.flushing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    this.flushing = true;
    try {
      const queue = this.readQueue();
      const remaining: QueueOp[] = [];
      const now = Date.now();
      for (const op of queue) {
        // TD-10: respect per-op backoff window; defer until nextRetryAt.
        if (op.nextRetryAt && op.nextRetryAt > now) {
          remaining.push(op);
          continue;
        }
        // v6.4.2: Drop ops carrying a non-UUID id. Records created before the
        // uid()→crypto.randomUUID() fix have ids like "mpe036yty4vnauz7yif",
        // which the uuid PK columns reject with 22P02. Retrying them forever
        // permanently jams the queue and blocks all later (valid) ops from
        // flushing. We drop them with a warning rather than retain them.
        if (!isQueueOpIdValid(op)) {
          if (typeof console !== 'undefined') {
            console.warn('[Vyact sync] Dropping un-syncable queued op with non-UUID id', op.op, op.entity, (op.payload as { id?: string })?.id ?? op.id);
          }
          continue;
        }
        try {
          if      (op.op === 'upsert')        await this.cloud.upsert(op.entity!, op.householdId, op.payload as { id?: string }, op.expectedUpdatedAt);
          else if (op.op === 'remove')        await this.cloud.remove(op.entity!, op.householdId, op.id!);
          else if (op.op === 'replaceAll')    await this.cloud.replaceAll(op.entity!, op.householdId, op.payload as unknown[]);
          else if (op.op === 'updateProfile') await this.cloud.updateProfile(op.householdId, op.payload as Partial<Profile>);
          else if (op.op === 'upsertRate')    await this.cloud.upsertRate(op.householdId, op.code!, op.rate!);
          // v6.4: a successful write proves we have valid cloud connectivity
          // and RLS access to this (hid, entity); mark synced so subsequent
          // empty list responses are trusted, not treated as transient.
          if (op.entity) this.markSynced(op.entity, op.householdId);
        } catch (e) {
          // TD-03 — concurrency conflict is a *terminal* outcome for this op,
          // not a retryable transient failure. The local cache already
          // reflects the user's intended edit; the cloud has a newer version
          // from someone else's write. Retrying would keep failing because
          // the precondition won't suddenly match again. Move the op to a
          // separate dead-letter bucket so the UI can surface it (TD-03
          // phase B will add the toast), and DO NOT push it back into the
          // main queue (would jam every later op).
          if (e instanceof ConcurrencyConflictError) {
            this.recordConflict(op);
            if (typeof console !== 'undefined') {
              console.warn('[Vyact sync] Concurrency conflict — op dead-lettered:', op.entity, e.id, 'expected', e.expectedUpdatedAt);
            }
            continue;
          }
          // TD-10: bounded retry with exponential backoff. After MAX_RETRIES
          // the op moves to the `vt_sync_failed` dead-letter so it stops
          // blocking subsequent flushes.
          const attempts = (op.attempts ?? 0) + 1;
          if (attempts >= MAX_RETRIES) {
            this.recordFailed(op, e);
            if (typeof console !== 'undefined') {
              console.warn('[Vyact sync] Op exhausted retries — moved to dead-letter:', op.op, op.entity, e);
            }
            continue;
          }
          remaining.push({ ...op, attempts, nextRetryAt: Date.now() + backoffMs(attempts) });
        }
      }
      this.writeQueue(remaining);
    } finally {
      this.flushing = false;
    }
  }

  private recordConflict(op: QueueOp): void {
    try {
      const list = ls.readJson<QueueOp[]>('sync_conflicts') || [];
      list.push(op);
      try { ls.setJson('sync_conflicts', list); } catch { /* noop */ }
    } catch { /* storage full — non-fatal */ }
  }

  private recordFailed(op: QueueOp, error: unknown): void {
    try {
      const list = ls.readJson<Array<QueueOp & { error?: string }>>('sync_failed') || [];
      list.push({ ...op, error: error instanceof Error ? error.message : String(error) });
      try { ls.setJson('sync_failed', list); } catch { /* noop */ }
    } catch { /* storage full — non-fatal */ }
  }

  pendingOpCount(): number {
    return this.readQueue().length;
  }

  /**
   * Number of ops that were rejected by the cloud due to a concurrency
   * conflict and are now in the dead-letter bucket awaiting user review.
   * UI surfaces this in TD-03 phase B (PR #12) as a "X edits couldn't be
   * saved" toast with a "Review" affordance.
   */
  pendingConflictCount(): number {
    try {
      const list = ls.readJson<QueueOp[]>('sync_conflicts') || [];
      return list.length;
    } catch { return 0; }
  }

  /**
   * Drop all dead-lettered conflict ops. Called from the UI's
   * `SyncConflictBanner` "Dismiss" affordance after the user has been
   * informed and (typically) re-applied any edits manually.
   */
  clearConflicts(): void {
    try { ls.removeBoth('sync_conflicts'); } catch { /* noop */ }
  }

  /**
   * R4 (sync fix) — number of ops that exhausted their retries and are now in
   * the `sync_failed` dead-letter bucket. Previously these vanished with NO
   * user-facing signal (a money write could silently never reach the cloud);
   * the sync-status UI now surfaces this so "all synced" can never be a lie.
   */
  pendingFailedCount(): number {
    try {
      const list = ls.readJson<QueueOp[]>('sync_failed') || [];
      return list.length;
    } catch { return 0; }
  }

  /** Drop the dead-lettered failed ops after the user has reviewed them. */
  clearFailed(): void {
    try { ls.removeBoth('sync_failed'); } catch { /* noop */ }
  }

  /**
   * R5 (sync fix) — re-queue a dead-lettered op for another flush attempt.
   * Used by the conflict/failed review UI's "Retry" affordance. For conflict
   * ops we strip `expectedUpdatedAt` so the retry is an unconditional
   * last-write-wins (the user has chosen to re-apply their edit on top of the
   * newer server row); retry counters reset so it isn't instantly re-dropped.
   */
  retryDeadLettered(bucket: 'sync_conflicts' | 'sync_failed'): void {
    try {
      const list = ls.readJson<QueueOp[]>(bucket) || [];
      if (!list.length) return;
      const queue = this.readQueue();
      for (const op of list) {
        queue.push({ ...op, attempts: 0, nextRetryAt: undefined, expectedUpdatedAt: undefined });
      }
      this.writeQueue(queue);
      ls.removeBoth(bucket);
      this.flushQueue();
    } catch { /* storage error — non-fatal */ }
  }
}
