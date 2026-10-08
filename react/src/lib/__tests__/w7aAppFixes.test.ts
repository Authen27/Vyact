// W7a (v10.80.0) — small app fixes from the 2026-10-04 audit (batch A). Each case is named after its
// finding. Vitest runs in node here (no DOM), so screen behaviour is pinned through the pure helpers
// it uses and, where a page must use them, through its source.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('W7a · small app fixes', () => {
  it('W7a-PIP17-001 · the chat is keyed on the household, so a switch starts a fresh conversation (FE-PIP-17)', () => {
    const chat = src('pages/Chat.tsx');
    expect(chat).toMatch(/export default function Chat\(props[^)]*\) \{\s*const householdId = useStore\(s => s\.currentHouseholdId\);\s*return <ChatForHousehold key=\{householdId\} \{\.\.\.props\} \/>;/);
  });
});
