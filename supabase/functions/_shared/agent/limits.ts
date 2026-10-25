// Pip's limits, as the gateway and the WhatsApp assistant answer them (v10.135.0, Track Q7; audit OPS-11; owner
// decisions 20 Oct 2026: "a rate limit with an off-topic cool-down", "a global daily ceiling, fail closed").
//
// The numbers live in the database (`ai_limits`, one row) and are decided there (`ai_limit_state`, called by
// prepare_ai_call() and reserve_ai_usage()). This file only names each answer and reads what a classify call decided.
// Pure, so it is unit-tested from Vitest.

/** What the database answered for one more model call. */
export type Quota = 'ok' | 'skipped' | 'exceeded' | 'rate_limited' | 'cooldown' | 'global_exceeded' | 'misconfigured';

export const QUOTAS: readonly Quota[] = ['ok', 'skipped', 'exceeded', 'rate_limited', 'cooldown', 'global_exceeded', 'misconfigured'];

export const isQuota = (v: unknown): v is Quota => typeof v === 'string' && (QUOTAS as readonly string[]).includes(v);

export interface LimitAnswer {
  status: number;
  /** The gateway's error code, read by the app (askVyactModelCall → ModelLimitError). */
  error: 'quota_exceeded' | 'rate_limited' | 'cooldown' | 'global_limit' | 'quota_misconfigured';
  message: string;
}

/** The gateway's answer for a refused call, or null when the call may go ahead. */
export function limitAnswer(quota: Quota): LimitAnswer | null {
  switch (quota) {
    case 'exceeded':
      return { status: 429, error: 'quota_exceeded', message: 'Daily assistant limit reached. Try again later.' };
    case 'rate_limited':
      return { status: 429, error: 'rate_limited', message: 'Too many questions in a minute. Try again shortly.' };
    case 'cooldown':
      return { status: 429, error: 'cooldown', message: 'Pip is paused for a few minutes after several questions that were not about money.' };
    case 'global_exceeded':
      return { status: 429, error: 'global_limit', message: 'Pip has reached its limit for today. Try again later.' };
    case 'misconfigured':
      // Fail closed: without its limits the model is never called.
      return { status: 503, error: 'quota_misconfigured', message: 'Pip\'s limits could not be read. Not calling the model.' };
    default:
      return null;
  }
}

/** Seconds until `retryAt` (an ISO time from the database), at least 1; null without one. */
export function retryAfterSeconds(retryAt: unknown, now: number = Date.now()): number | null {
  if (typeof retryAt !== 'string') return null;
  const at = Date.parse(retryAt);
  return Number.isFinite(at) ? Math.max(1, Math.ceil((at - now) / 1000)) : null;
}

/** reserve_ai_usage() raises the refused quota's name (42901), or quota_misconfigured (55000). */
export function quotaFromReserveError(err: { code?: string | null; message?: string | null }): Quota | null {
  const text = err.message ?? '';
  if (err.code === '55000' || /quota_misconfigured/.test(text)) return 'misconfigured';
  if (/\brate_limited\b/.test(text)) return 'rate_limited';
  if (/\bcooldown\b/.test(text)) return 'cooldown';
  if (/\bglobal_exceeded\b/.test(text)) return 'global_exceeded';
  if (err.code === '42901' || /quota_exceeded/.test(text)) return 'exceeded';
  return null;
}

/**
 * 'off_topic' when a classify call's reply placed the question off topic, else null. This is what the cool-down
 * counts (ai_usage.intent on the gateway's own row): the server's reading of the model's answer, never the app's.
 * The reply is the classifier's JSON (`{"id": …}`), possibly in a code fence.
 */
export function offTopicIntent(op: unknown, text: string | null | undefined): 'off_topic' | null {
  if (op !== 'classify' || typeof text !== 'string') return null;
  const raw = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && (parsed as { id?: unknown }).id === 'off_topic' ? 'off_topic' : null;
  } catch {
    return null;   // fault-ok: an unparseable classification is not an off-topic one (the app treats it as a fallback)
  }
}
