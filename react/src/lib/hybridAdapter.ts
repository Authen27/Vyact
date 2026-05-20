// FinFlow v4.1 — HybridAdapter
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
import { SupabaseAdapter } from './supabaseAdapter';
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
}

const QUEUE_KEY = 'ff_sync_queue';

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
    this.cloud.list<T>(entity, householdId)
      .then(fresh => this.applyCloudList(entity, householdId, cached as unknown[], fresh as unknown[]))
      .catch(() => {/* network error — cache stays */});
    return cached;
  }

  private syncedKey(entity: Entity, householdId: string): string {
    return `ff_cloud_synced_${householdId}_${entity}`;
  }
  private hasSynced(entity: Entity, householdId: string): boolean {
    try { return localStorage.getItem(this.syncedKey(entity, householdId)) === '1'; }
    catch { return false; }
  }
  private markSynced(entity: Entity, householdId: string): void {
    try { localStorage.setItem(this.syncedKey(entity, householdId), '1'); }
    catch { /* storage full — non-fatal */ }
  }
  private async applyCloudList(entity: Entity, householdId: string, cached: unknown[], fresh: unknown[]): Promise<void> {
    if (fresh.length > 0) {
      await this.cache.replaceAll(entity, householdId, fresh);
      this.markSynced(entity, householdId);
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
      console.warn(`[FinFlow sync] Empty cloud response for ${entity}@${householdId}; keeping ${cached.length} cached rows. Use forceFullResync to override.`);
    }
  }

  /** Clear the synced sentinel for a household so the next list() treats
   *  empty cloud responses as transient again. Call when you suspect
   *  cache corruption or want to re-trust the cloud. */
  forceFullResync(householdId: string): void {
    const entities: Entity[] = ['transactions','budgets','goals','debts','assets','members'];
    for (const e of entities) {
      try { localStorage.removeItem(this.syncedKey(e, householdId)); } catch { /* noop */ }
    }
  }

  // ── Write path: cache + queue + try flush ──────────────────
  async upsert<T extends { id?: string }>(entity: Entity, householdId: string, record: T): Promise<T & { id: string }> {
    const local = await this.cache.upsert(entity, householdId, record);
    this.enqueue({ ts: Date.now(), op: 'upsert', entity, householdId, payload: local });
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

  // ── Households: cloud is source of truth ───────────────────
  async listHouseholds(): Promise<HouseholdMeta[]> {
    try {
      const cloud = await this.cloud.listHouseholds();
      localStorage.setItem('ff_cloud_households', JSON.stringify(cloud));
      return cloud;
    } catch {
      return JSON.parse(localStorage.getItem('ff_cloud_households') || '[]');
    }
  }
  async createHousehold(name: string, type: ProfileTypeKey, baseCurrency = 'USD'): Promise<HouseholdMeta> {
    const created = await this.cloud.createHousehold(name, type, baseCurrency);
    const list = await this.listHouseholds();
    localStorage.setItem('ff_cloud_households', JSON.stringify([...list, created]));
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
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
  private readQueue(): QueueOp[] {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
    catch { return []; }
  }
  private writeQueue(q: QueueOp[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }

  async flushQueue(): Promise<void> {
    if (this.flushing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    this.flushing = true;
    try {
      const queue = this.readQueue();
      const remaining: QueueOp[] = [];
      for (const op of queue) {
        // v6.4.2: Drop ops carrying a non-UUID id. Records created before the
        // uid()→crypto.randomUUID() fix have ids like "mpe036yty4vnauz7yif",
        // which the uuid PK columns reject with 22P02. Retrying them forever
        // permanently jams the queue and blocks all later (valid) ops from
        // flushing. We drop them with a warning rather than retain them.
        if (!isQueueOpIdValid(op)) {
          if (typeof console !== 'undefined') {
            console.warn('[FinFlow sync] Dropping un-syncable queued op with non-UUID id', op.op, op.entity, (op.payload as { id?: string })?.id ?? op.id);
          }
          continue;
        }
        try {
          if      (op.op === 'upsert')        await this.cloud.upsert(op.entity!, op.householdId, op.payload as { id?: string });
          else if (op.op === 'remove')        await this.cloud.remove(op.entity!, op.householdId, op.id!);
          else if (op.op === 'replaceAll')    await this.cloud.replaceAll(op.entity!, op.householdId, op.payload as unknown[]);
          else if (op.op === 'updateProfile') await this.cloud.updateProfile(op.householdId, op.payload as Partial<Profile>);
          else if (op.op === 'upsertRate')    await this.cloud.upsertRate(op.householdId, op.code!, op.rate!);
          // v6.4: a successful write proves we have valid cloud connectivity
          // and RLS access to this (hid, entity); mark synced so subsequent
          // empty list responses are trusted, not treated as transient.
          if (op.entity) this.markSynced(op.entity, op.householdId);
        } catch {
          remaining.push(op);
        }
      }
      this.writeQueue(remaining);
    } finally {
      this.flushing = false;
    }
  }

  pendingOpCount(): number {
    return this.readQueue().length;
  }
}
