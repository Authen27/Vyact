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
  async list<T = unknown>(entity: Entity, householdId: string): Promise<T[]> {
    const cached = await this.cache.list<T>(entity, householdId);
    // Background refresh — fire and forget
    this.cloud.list<T>(entity, householdId)
      .then(fresh => this.cache.replaceAll(entity, householdId, fresh as unknown[]))
      .catch(() => {/* network error — cache stays */});
    return cached;
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
        try {
          if      (op.op === 'upsert')        await this.cloud.upsert(op.entity!, op.householdId, op.payload as { id?: string });
          else if (op.op === 'remove')        await this.cloud.remove(op.entity!, op.householdId, op.id!);
          else if (op.op === 'replaceAll')    await this.cloud.replaceAll(op.entity!, op.householdId, op.payload as unknown[]);
          else if (op.op === 'updateProfile') await this.cloud.updateProfile(op.householdId, op.payload as Partial<Profile>);
          else if (op.op === 'upsertRate')    await this.cloud.upsertRate(op.householdId, op.code!, op.rate!);
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
