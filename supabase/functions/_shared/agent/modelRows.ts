// Vyact Agent — which model config rows apply to a caller (v10.38; relay removed in v10.135.0, Track Q7).
//
// `params.allowed_user_ids` PILOTS A MODEL ON SOME ACCOUNTS. A row carrying the key serves only those user ids;
// every other caller skips it and resolves the next row by priority. A row WITHOUT the key serves everyone, so
// adding the key to nothing changes nothing.
//
// The rule exists because a pilot model is not a production model: a self-hosted endpoint on somebody's desk is
// offline when that machine sleeps, and the whole household should not be routed through it to find out. When the
// pilot is proven, removing the key from the row promotes it to everyone in one edit, with no deploy.
//
// prepare_ai_call() applies the same rule in SQL, so it reserves nothing when no row applies.
//
// Pure helpers only, so they are unit-testable from Vitest.

interface ModelRowLike {
  /** Any params object (ModelParams has no index signature); only allowed_user_ids is read here. */
  params?: object | null;
}

/** Does this config row apply to this caller? */
export function rowAppliesToUser<T extends ModelRowLike>(row: T, userId: string): boolean {
  const ids = (row.params as { allowed_user_ids?: unknown } | null | undefined)?.allowed_user_ids;
  if (!Array.isArray(ids)) return true;                 // no allowlist ⇒ everyone
  return ids.some(id => typeof id === 'string' && id === userId);
}

/** Keep only the config rows that apply to this caller (see `rowAppliesToUser`). */
export function filterRowsForUser<T extends ModelRowLike>(rows: readonly T[], userId: string): T[] {
  return rows.filter(row => rowAppliesToUser(row, userId));
}
