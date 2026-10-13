// ADM-03 / FE-PUB-01, step 2 (admin v1.4.5, consumer v10.93.0; owner decision 13 Oct 2026) — the Audit
// page shows who did what and when, never the values. It reads `admin_activity_feed` (no `changes`),
// never the activity_log table; the CSV and the Help page say the same; Privacy tells users so.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { rpc, from } = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ data: [{ id: 'a', action: 'created', entity_type: 'transaction', created_at: '2026-10-13T10:00:00Z' }], error: null })),
  from: vi.fn(() => { throw new Error('the Audit page must not read a table'); }),
}));
vi.mock('../supabase', () => ({ sb: () => ({ rpc, from }) }));

import { fetchActivityLog } from '../adminApi';

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');
const consumer = (p: string) => readFileSync(resolve(__dirname, '../../../../react/src', p), 'utf8');

describe('ADM-03 · the Audit page without values', () => {
  it('ADM03-A-001 · the page reads the server feed, never the table', async () => {
    expect(await fetchActivityLog()).toHaveLength(1);
    expect(rpc).toHaveBeenLastCalledWith('admin_activity_feed', { p_limit: 200, p_before: null });
    await fetchActivityLog(50, '2026-10-01T00:00:00Z');
    expect(rpc).toHaveBeenLastCalledWith('admin_activity_feed', { p_limit: 50, p_before: '2026-10-01T00:00:00Z' });
    expect(from).not.toHaveBeenCalled();
    const api = src('lib/adminApi.ts');
    expect(api).not.toMatch(/from\('activity_log'\)/);
    const row = api.slice(api.indexOf('export interface AdminActivityRow'), api.indexOf('export async function fetchActivityLog'));
    expect(row).not.toMatch(/changes/);
  });

  it('ADM03-A-002 · neither the page nor its CSV shows a value, and Help no longer promises a diff', () => {
    const page = src('pages/Audit.tsx').replace(/\/\/[^\n]*/g, '');
    expect(page).not.toMatch(/\.changes\b|'changes'/);
    expect(page).toMatch(/const headers = \['created_at', 'actor_id', 'household_id', 'action', 'entity_type', 'entity_id'\];/);
    expect(page).not.toMatch(/append-only|admins read-all via RLS/);
    const help = src('pages/Help.tsx');
    expect(help).not.toMatch(/JSON diff|diff column|IP column|before\/after JSON/);
    expect(help).toMatch(/It never shows amounts, names or descriptions\./);
  });

  it('ADM03-A-003 · Privacy says what staff can see, under a new policy version', () => {
    expect(consumer('pages/Privacy.tsx')).toMatch(
      /In the admin console, Vyact staff can see that an action happened in a household \(its time and kind\), never the amounts, names or descriptions it changed\./);
    expect(consumer('lib/policyVersion.ts')).toMatch(/export const POLICY_VERSION = '2026-10-13';/);
  });
});
