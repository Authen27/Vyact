// W8c (audit INT-CON-06, INT-HH-14) — the household types the database holds today, for the admin app.
// The admin list still offered the retired 'multi_biz' / 'shared' and had no 'couple'. The consumer app's
// rule (react/src/lib/householdTypes.ts) is the source; a parity test keeps this copy equal to it.
export type HouseholdType = 'personal' | 'couple' | 'family' | 'business';

export const HOUSEHOLD_TYPES: readonly HouseholdType[] = ['personal', 'couple', 'family', 'business'];

/** A stored type, as one of today's four: 'shared' (retired) is family, 'multi_biz' is business,
 *  anything unknown is family. */
export function normalizeHouseholdType(type: unknown): HouseholdType {
  switch (type) {
    case 'personal': case 'couple': case 'family': case 'business': return type;
    case 'shared': return 'family';
    case 'multi_biz': return 'business';
    default: return 'family';
  }
}
