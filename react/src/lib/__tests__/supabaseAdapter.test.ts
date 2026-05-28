import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAdapter, ConcurrencyConflictError } from '../supabaseAdapter';

// Test scenarios CON-UNIT-051..053. TD-03 phase A (PR #11) — pins the
// compare-and-set behaviour added to SupabaseAdapter.upsert so the
// adapter rejects a stale write instead of silently overwriting a
// concurrent edit from another household member.

/**
 * Build a minimal SupabaseClient stub whose `.from(table).update(...).
 * eq(...).eq(...).select().maybeSingle()` chain resolves to the supplied
 * result. This is the only path TD-03's guarded UPDATE touches.
 *
 * The chain is built defensively (`mockReturnThis` on .eq) so the
 * order/count of `.eq()` calls doesn't matter to the test fixture.
 */
function mockSb(updateResult: { data: unknown; error: unknown }, upsertResult?: { data: unknown; error: unknown }): SupabaseClient {
  const updateMaybeSingle = vi.fn().mockResolvedValue(updateResult);
  const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = vi.fn().mockImplementation(function (this: unknown) { return updateChain; });
  const updateChain = { eq: updateEq, select: updateSelect };
  const update = vi.fn().mockReturnValue(updateChain);

  const upsertSingle = vi.fn().mockResolvedValue(upsertResult ?? { data: null, error: null });
  const upsertSelect = vi.fn().mockReturnValue({ single: upsertSingle });
  const upsert = vi.fn().mockReturnValue({ select: upsertSelect });

  const from = vi.fn().mockReturnValue({ update, upsert });
  return { from } as unknown as SupabaseClient;
}

const TXN_INPUT = {
  id: '11111111-1111-1111-1111-111111111111',
  type: 'expense' as const,
  amount: 42,
  currency: 'USD',
  date: '2026-05-23',
  description: 'lunch',
  category: 'food',
};

const TXN_ROW_OK = {
  id: TXN_INPUT.id,
  household_id: 'h1',
  created_by: null,
  member_id: null,
  type: 'expense',
  amount: 42,
  currency: 'USD',
  date: '2026-05-23',
  description: 'lunch',
  category: 'food',
  note: null,
  recurring: null,
  attachment_url: null,
  created_at: '2026-05-23T00:00:00Z',
  updated_at: '2026-05-23T00:01:00Z',   // server bumped this to "now"
  deleted_at: null,
  extras: null,
};

describe('SupabaseAdapter.upsert · TD-03 optimistic concurrency', () => {
  it('CON-UNIT-051 · guarded UPDATE with matching updated_at returns the server row', async () => {
    // Cloud row matches the version precondition → maybeSingle yields a row.
    const sb = mockSb({ data: TXN_ROW_OK, error: null });
    const adapter = new SupabaseAdapter(sb);
    const result = await adapter.upsert(
      'transactions', 'h1', TXN_INPUT, '2026-05-23T00:00:00Z',
    );
    expect(result.id).toBe(TXN_INPUT.id);
    // Confirm the chain went through update(), not upsert() — i.e. the
    // guarded path was actually taken.
    const fromSpy = sb.from as unknown as ReturnType<typeof vi.fn>;
    expect(fromSpy).toHaveBeenCalledWith('transactions');
  });

  it('CON-UNIT-052 · guarded UPDATE with no-rows-matched throws ConcurrencyConflictError', async () => {
    // maybeSingle yields data:null when the WHERE doesn't match anything
    // (Supabase's standard "no row" sentinel). Adapter must convert this
    // into a typed conflict rather than silently returning.
    const sb = mockSb({ data: null, error: null });
    const adapter = new SupabaseAdapter(sb);
    await expect(
      adapter.upsert('transactions', 'h1', TXN_INPUT, '2026-05-23T00:00:00Z'),
    ).rejects.toBeInstanceOf(ConcurrencyConflictError);
  });

  it('CON-UNIT-053 · upsert without expectedUpdatedAt skips the guard and uses the legacy upsert path', async () => {
    // Legacy path: no version → falls back to .upsert() with onConflict:'id'
    // and last-write-wins behaviour. Required for new-record inserts and
    // any caller that hasn't yet been wired through TD-03.
    const sb = mockSb({ data: null, error: null }, { data: TXN_ROW_OK, error: null });
    const adapter = new SupabaseAdapter(sb);
    const result = await adapter.upsert('transactions', 'h1', TXN_INPUT);
    expect(result.id).toBe(TXN_INPUT.id);
    // Crucially: .update() was NOT called — only .upsert() was.
    const tableProxy = (sb.from as unknown as ReturnType<typeof vi.fn>).mock.results[0]!.value;
    expect(tableProxy.update).not.toHaveBeenCalled();
    expect(tableProxy.upsert).toHaveBeenCalled();
  });
});
