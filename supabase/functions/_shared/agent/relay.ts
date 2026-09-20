// Vyact Agent — CLAUDE CODE RELAY (v10.37.0). TEST-WINDOW WORKAROUND, NOT A PROVIDER.
//
// While the free OpenRouter model timed out on nearly every call, the product owner
// asked for a developer's Claude Code session to stand in as the model during a test
// cycle. The relay is a "provider" row (`provider = 'claude-code-relay'`) that, instead
// of calling an HTTP endpoint, queues the exact messages the model would have received
// in `ask_vyact_relay`; the Claude Code session answers the row, and the client polls.
//
// 🔴 Binding limits:
//   • ALLOWLIST ONLY. A relay row applies to the user ids in `params.allowed_user_ids`
//     and to nobody else — an empty or missing list allows no one. Every other user
//     resolves the next enabled config exactly as before.
//   • The client pipeline is unchanged: classify → resolve → phrase, and
//     assertNoInventedFigures still judges every reply. The relay changes WHO writes
//     the text, never what data it is allowed to use.
//   • `ask_vyact_relay` stores message CONTENT — a deliberate, temporary exception to
//     the metadata-only rule, scoped to the allowlisted test account. TD-44: remove the
//     relay once testing ends.
//
// Pure helpers only, so they are unit-testable from Vitest.

export const RELAY_PROVIDER = 'claude-code-relay';
export const RELAY_MODEL_LABEL = 'claude-opus-5 (Claude Code)';
/** How long a queued call may wait for an answer before it is expired. */
export const RELAY_TTL_MS = 5 * 60 * 1000;

export type RelayCallKind = 'classify' | 'phrase' | 'other';

interface RelayConfigLike {
  provider?: string | null;
  params?: Record<string, unknown> | null;
}

export function isRelayConfig(row: RelayConfigLike | null | undefined): boolean {
  return !!row && row.provider === RELAY_PROVIDER;
}

/** True only when the caller is explicitly allowlisted on this relay row. */
export function relayAllows(row: RelayConfigLike | null | undefined, userId: string): boolean {
  if (!isRelayConfig(row) || !userId) return false;
  const ids = row?.params?.allowed_user_ids;
  return Array.isArray(ids) && ids.some(id => typeof id === 'string' && id === userId);
}

/**
 * Drop relay rows the caller is not allowlisted for. Non-relay rows pass through
 * untouched, so a non-test user resolves exactly the config they did before.
 */
export function filterRelayRows<T extends RelayConfigLike>(rows: readonly T[], userId: string): T[] {
  return rows.filter(row => !isRelayConfig(row) || relayAllows(row, userId));
}

/**
 * v10.38 — does this config row apply to this caller?
 *
 * `params.allowed_user_ids` PILOTS A MODEL ON ONE ACCOUNT. A row carrying the key
 * serves only those user ids; every other caller skips it and resolves the next
 * row by priority. A row WITHOUT the key serves everyone, exactly as before — so
 * adding the key to nothing changes nothing.
 *
 * The rule exists because a pilot model is not a production model: a self-hosted
 * endpoint on somebody's desk is offline when that machine sleeps, and the whole
 * household should not be routed through it to find out. When the pilot is proven,
 * removing the key from the row promotes it to everyone in one edit, with no deploy.
 *
 * A relay row is the strict case: it REQUIRES an allowlist (see `relayAllows`),
 * because an unanswered relay call is a five-minute wait and a failed turn.
 */
export function rowAppliesToUser<T extends RelayConfigLike>(row: T, userId: string): boolean {
  if (isRelayConfig(row)) return relayAllows(row, userId);
  const ids = row?.params?.allowed_user_ids;
  if (!Array.isArray(ids)) return true;                 // no allowlist ⇒ everyone
  return ids.some(id => typeof id === 'string' && id === userId);
}

/** Keep only the config rows that apply to this caller (see `rowAppliesToUser`). */
export function filterRowsForUser<T extends RelayConfigLike>(rows: readonly T[], userId: string): T[] {
  return rows.filter(row => rowAppliesToUser(row, userId));
}

/**
 * Label a queued call for the run log. CLASSIFY_SYSTEM names the task ("classify");
 * PHRASE_SYSTEM deliberately never contains that word. Labelling only — nothing
 * branches on it.
 */
export function detectCallKind(messages: ReadonlyArray<{ role: string; content: string }>): RelayCallKind {
  const system = messages.find(m => m.role === 'system')?.content ?? '';
  if (!system) return 'other';
  return /classify/i.test(system) ? 'classify' : 'phrase';
}

export type RelayRowStatus = 'pending' | 'answered' | 'expired';

export interface RelayRowLike {
  status: RelayRowStatus;
  created_at: string;
  answered_at?: string | null;
  response?: string | null;
}

export type RelayPollState =
  | { state: 'answered'; text: string; latencyMs: number }
  | { state: 'pending' }
  | { state: 'expired' };

/** Decide what a poll returns. `now` is injectable for tests. */
export function relayPollState(row: RelayRowLike, now: number = Date.now()): RelayPollState {
  const created = Date.parse(row.created_at);
  if (row.status === 'answered' && typeof row.response === 'string' && row.response.trim()) {
    const answered = row.answered_at ? Date.parse(row.answered_at) : now;
    return { state: 'answered', text: row.response, latencyMs: Math.max(0, answered - created) };
  }
  if (row.status === 'expired') return { state: 'expired' };
  if (Number.isFinite(created) && now - created > RELAY_TTL_MS) return { state: 'expired' };
  return { state: 'pending' };
}
