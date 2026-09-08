import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  invalidateCacheForSession, clearCacheOnSignOut, purgeCachedCloudData, CACHE_EPOCH,
} from '../cacheInvalidation';

// CON-UNIT-099..103 — cache invalidation at the session boundary.
//
// The local store is a CACHE of cloud state, and until v10.20.7 nothing ever
// invalidated it. Two production consequences:
//
//   PRIVACY — signing in as a second user on a shared device left the first
//   user's households and transactions in localStorage, and the adapter answers
//   from cache before the network replies.
//
//   GHOST ROWS — rows whose cloud write had FAILED lived on locally and were
//   re-uploaded by the next sync, so a deleted schedule came back.
//   `recurring_schedules` held ZERO rows in production for months while devices
//   rendered a full list from cache.


// vitest runs in the `node` environment (vitest.config.ts), so install the same
// minimal localStorage polyfill storage.test.ts uses. purgeCachedCloudData walks
// localStorage by index, so length/key(i) must behave.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
}
const g = globalThis as unknown as { localStorage?: MemStorage };
beforeEach(() => { g.localStorage = new MemStorage(); });
afterEach(() => { delete g.localStorage; });

const HID = '1c859cf7-6a30-4db5-b615-3ecf94c8a02c';
const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOB   = 'bbbbbbbb-0000-4000-8000-000000000002';

/** Populate a device as if Alice had been using it. */
function seedDeviceFor(uid: string) {
  localStorage.clear();
  localStorage.setItem(`vt_${HID}_transactions`, '[{"id":"t1"}]');
  localStorage.setItem(`vt_${HID}_recurring`, '[{"id":"bf-legacy"}]');
  localStorage.setItem(`vt_${HID}_accounts`, '[{"id":"a1"}]');
  localStorage.setItem('vt_households', '[{"id":"h1"}]');
  localStorage.setItem(`vt_cloud_synced_${HID}`, '1');
  localStorage.setItem(`vt_recurring_backfilled_${HID}`, '1');
  // Legacy namespace must be swept too — the app still reads ff_* keys.
  localStorage.setItem(`ff_${HID}_transactions`, '[{"id":"t1"}]');
  // The user's own unsynced work, and device preferences.
  localStorage.setItem('vt_sync_queue', '[{"op":"upsert"}]');
  localStorage.setItem('vt_theme', 'dark');
  localStorage.setItem('vt_last_cloud_hid', HID);
  // Stamp it as belonging to `uid` at the CURRENT epoch.
  localStorage.setItem('vt_cache_owner_uid', uid);
  localStorage.setItem('vt_cache_epoch', CACHE_EPOCH);
}

describe('cacheInvalidation · the local cache is dropped when it cannot be trusted', () => {
  it('CON-UNIT-099 · a different user signing in gets none of the previous user\'s data', () => {
    seedDeviceFor(ALICE);
    const out = invalidateCacheForSession(BOB);

    expect(out.action).toBe('purged');
    expect(out.reason).toBe('different-user');
    // THE PRIVACY ASSERTION. Nothing of Alice's ledger may survive into Bob's
    // session — the adapter reads cache before the network answers.
    expect(localStorage.getItem(`vt_${HID}_transactions`)).toBeNull();
    expect(localStorage.getItem(`vt_${HID}_accounts`)).toBeNull();
    expect(localStorage.getItem('vt_households')).toBeNull();
    expect(localStorage.getItem(`ff_${HID}_transactions`), 'legacy namespace too').toBeNull();
    // And the device is now stamped as Bob's.
    expect(localStorage.getItem('vt_cache_owner_uid')).toBe(BOB);
  });

  it('CON-UNIT-100 · the same user keeps their cache, so offline work is not thrown away', () => {
    seedDeviceFor(ALICE);
    const out = invalidateCacheForSession(ALICE);

    expect(out.action).toBe('kept');
    expect(localStorage.getItem(`vt_${HID}_transactions`)).not.toBeNull();
  });

  it('CON-UNIT-101 · a stale epoch forces a purge even for the same user', () => {
    // The shipped reset lever: bump CACHE_EPOCH and every device drops its cache
    // once, at next sign-in. This is what stops a device re-uploading schedules
    // the cloud no longer has.
    seedDeviceFor(ALICE);
    localStorage.setItem('vt_cache_epoch', 'v0.0.1-old');

    const out = invalidateCacheForSession(ALICE);
    expect(out.action).toBe('purged');
    expect(out.reason).toBe('stale-epoch');
    expect(localStorage.getItem(`vt_${HID}_recurring`)).toBeNull();
    expect(localStorage.getItem('vt_cache_epoch')).toBe(CACHE_EPOCH);
  });

  it('CON-UNIT-102 · the unsynced write queue and device preferences always survive', () => {
    seedDeviceFor(ALICE);
    invalidateCacheForSession(BOB);

    // Dropping the queue would be DATA LOSS — those are changes the user made
    // that have not reached the server yet. They flush after the purge.
    expect(localStorage.getItem('vt_sync_queue')).toBe('[{"op":"upsert"}]');
    expect(localStorage.getItem('vt_theme')).toBe('dark');
    expect(localStorage.getItem('vt_last_cloud_hid')).toBe(HID);
  });

  it('CON-UNIT-103 · sentinels are cleared, or the reset silently does nothing', () => {
    // `cloud_synced_*` tells the adapter it has already seen a non-empty cloud
    // result; `recurring_backfilled_*` suppresses a migration. Leaving either
    // behind after wiping the data they describe is how a reset fails halfway.
    seedDeviceFor(ALICE);
    purgeCachedCloudData();
    expect(localStorage.getItem(`vt_cloud_synced_${HID}`)).toBeNull();
    expect(localStorage.getItem(`vt_recurring_backfilled_${HID}`)).toBeNull();
  });

  it('CON-UNIT-104 · signing out leaves no ledger on the device', () => {
    seedDeviceFor(ALICE);
    clearCacheOnSignOut();
    expect(localStorage.getItem(`vt_${HID}_transactions`)).toBeNull();
    expect(localStorage.getItem('vt_cache_owner_uid')).toBeNull();
    // Still preserved: unsynced work, and where to land on next sign-in.
    expect(localStorage.getItem('vt_sync_queue')).not.toBeNull();
    expect(localStorage.getItem('vt_last_cloud_hid')).toBe(HID);
  });
});
