// ADM-09 / OPS-05 (admin v1.5.0). The admin console reads and writes every household through staff RPCs, so a
// build of unreviewed code must never point at production. Vercel builds admin previews only for `staging` and
// `develop` (scripts/ignore-build.sh, run by vercel.json), whose Preview env names vyact-test; every other branch is skipped. This
// is the second line: a preview build whose Supabase URL is production's fails, before anything is built (the
// committed .env.production names production, so a preview with no env of its own would otherwise use it).

export const PROD_SUPABASE_REF = 'dmxqkvploojokffuhxnz';

/** Why this build must not go ahead, or null. `vercelEnv` is VERCEL_ENV; `url` the resolved VITE_SUPABASE_URL. */
export function previewProblem(vercelEnv: string | undefined, url: string | undefined): string | null {
  if (vercelEnv !== 'preview') return null;
  if (!url) return 'An admin preview needs VITE_SUPABASE_URL for vyact-test (Preview env, staging/develop).';
  if (url.includes(PROD_SUPABASE_REF)) {
    return 'An admin preview build points at the production database (ADM-09). Set the Preview env to vyact-test.';
  }
  return null;
}
