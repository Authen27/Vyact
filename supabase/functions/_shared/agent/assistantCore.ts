// Ask Vyact — the model call for a SERVER caller (W4, v10.45.0).
//
// The `ask-vyact` gateway serves the app, and refuses service tokens by design, so
// the WhatsApp webhook cannot call it over HTTP. This is the same sequence the
// gateway runs for a signed-in user, from the same shared pieces:
//   resolve the enabled `ai_model_configs` row for the seam (pilot allowlists from
//   modelRows.ts) → reserve under Pip's limits atomically (`reserve_ai_usage` →
//   ai_limit_state, fail CLOSED; v10.135.0 always, with or without the gateway's cap) →
//   `chatCompletion` → finalise the `ai_usage` row (metadata only, never message
//   content; 'off_topic' on a classify call placed off topic), surface 'whatsapp'.
//
// Returns a function with the engine's ModelCall shape. Any failure throws; the
// engine turns that into an explicit "unavailable" turn — never a canned answer.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { buildUsageRow, chatCompletion, selectModelConfig, type ModelConfigRow } from './router.ts';
import { filterRowsForUser } from './modelRows.ts';
import { offTopicIntent, quotaFromReserveError } from './limits.ts';

/** The engine's ModelCall shape; `op` says which of Pip's prompts this is. */
export type ServerModelCall = (req: { op?: string; system: string; user: string; json?: boolean; maxTokens?: number }) => Promise<string>;

export interface ServerCaller {
  userId: string;
  householdId: string;
  surface: 'whatsapp';
  /** Per-user daily call cap — the gateway's (`parseDailyCallCap`); null for an explicit `off`, which leaves the
   *  database's own cap (ai_limits) in force. The gateway's cap can only lower it. */
  dailyCap: number | null;
  timeoutMs?: number;
  /** Where the metering promise goes (EdgeRuntime.waitUntil); awaited when absent. */
  waitUntil?: (p: Promise<unknown>) => void;
}

export function serverModelCall(admin: SupabaseClient, caller: ServerCaller): ServerModelCall {
  // `json` / `maxTokens` are accepted and not forwarded — exactly as the gateway
  // (params.max_tokens on the config row is the cap; see CLAUDE.md, v10.37).
  return async ({ op, system, user }) => {
    const { data: rows, error } = await admin
      .from('ai_model_configs')
      .select('id, seam, provider, model, base_url, key_env_var, params, enabled, priority')
      .eq('seam', 'assistant')
      .eq('enabled', true);
    // Cannot tell enabled from disabled: behave as off (the gateway's rule).
    if (error) throw new Error('model configuration could not be read');
    const eligible = filterRowsForUser((rows ?? []) as unknown as ModelConfigRow[], caller.userId);
    const config = selectModelConfig(eligible, 'assistant');
    if (!config) throw new Error('no model is enabled for the assistant');

    const { data: resId, error: resErr } = await admin.rpc('reserve_ai_usage', {
      p_user_id: caller.userId, p_household_id: caller.householdId, p_surface: caller.surface, p_cap: caller.dailyCap,
    });
    if (resErr) {
      const quota = quotaFromReserveError(resErr);
      throw new Error(quota === 'exceeded' ? 'quota_exceeded' : quota ?? 'quota_check_failed');
    }
    const reservationId = resId as string | null;

    const result = await chatCompletion(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { config, timeoutMs: caller.timeoutMs },
    );

    const usageRow = buildUsageRow(result, { householdId: caller.householdId, userId: caller.userId, surface: caller.surface, tier: 't1' });
    const intent = result.ok ? offTopicIntent(op, result.text) : null;
    if (usageRow && intent) usageRow.intent = intent;
    const meter = (async () => {
      try {
        if (reservationId) {
          const patch: Record<string, unknown> = usageRow
            ? { ...usageRow } : { outcome: 'error', prompt_tokens: 0, completion_tokens: 0 };
          delete patch.id; delete patch.user_id; delete patch.household_id;
          const { error: e } = await admin.from('ai_usage').update(patch).eq('id', reservationId);
          if (e) console.error('[assistantCore] metering finalise failed', reservationId, e.message);
        } else if (usageRow) {
          const { error: e } = await admin.from('ai_usage').insert(usageRow);
          if (e) console.error('[assistantCore] metering insert failed', e.message);
        }
      } catch (e) {
        console.error('[assistantCore] metering threw', reservationId, (e as Error)?.message);
      }
    })();
    if (caller.waitUntil) caller.waitUntil(meter); else await meter;

    if (!result.ok) throw new Error(result.message ?? result.code ?? 'model error');
    if (!result.text) throw new Error('model returned no text');
    return result.text;
  };
}
