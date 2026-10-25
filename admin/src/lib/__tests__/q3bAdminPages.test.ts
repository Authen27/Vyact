import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { activityActorLabel, staffActorLabel, staffChangeSummary } from '../auditLabels';
import { infographicProblem, INFOGRAPHIC_MAX_BYTES } from '../contentApi';
import { revenueFromMap, revenueLabel } from '../revenue';
import { previewProblem, PROD_SUPABASE_REF } from '../../../previewGuard';
import type { StaffAuditRow } from '../adminApi';

// Q3B-ADM-001..008 — admin v1.5.0 (Track Q3b; audit ADM-04, ADM-07, ADM-08, ADM-09, ADM-10, ADM-14, INT-HH-14,
// OPS-05; owner decisions 20 Oct 2026). The admin app reads what Q3a (v10.130.0) gives it, and its pages are the
// server's tiers.

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const root = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('admin v1.5.0 (Q3b)', () => {
  it('Q3B-ADM-001 · one page-to-tier table, read by the sidebar and the routes (ADM-07)', () => {
    expect(src('components/Layout.tsx')).toMatch(/canAccessPage\(role, n\.page\)/);
    expect(src('components/Layout.tsx')).not.toMatch(/ROLE_PAGES/);
    expect(src('App.tsx')).toMatch(/can\('dashboard'\)\s+\? <Dashboard \/>\s+: <Navigate to=\{homePath\(role\)\}/);
  });

  it('Q3B-ADM-002 · the lists page on the server, with server counts (ADM-08, INT-HH-14)', () => {
    const api = src('lib/adminApi.ts');
    for (const rpc of ['admin_list_users_page', 'admin_list_households', 'admin_people_summary']) expect(api).toContain(`rpc('${rpc}'`);
    expect(api).not.toMatch(/from\('memberships'\)/);
    expect(api).not.toMatch(/fetchAllUsers|fetchAllHouseholds/);
    for (const page of ['pages/Users.tsx', 'pages/Households.tsx']) {
      const s = src(page);
      expect(s, page).toMatch(/fetchPeopleSummary\(\)/);
      expect(s, page).toMatch(/<Pager offset=\{offset\} total=\{total\}/);
      expect(s, page).not.toMatch(/users\.filter\(|rows\.filter\(h =>/);
    }
  });

  it('Q3B-ADM-003 · staff roles change through the RPCs, by a real super admin only (ADM-04)', () => {
    const users = src('pages/Users.tsx');
    expect(users).toMatch(/const canChangeRoles = serverRole === 'super' && role === 'super';/);
    expect(src('lib/adminApi.ts')).toMatch(/rpc\('grant_admin_role'/);
    expect(src('lib/adminApi.ts')).toMatch(/rpc\('revoke_admin_role'/);
    expect(users).toMatch(/last_super_admin/);
  });

  it('Q3B-ADM-004 · Staff actions name the actor and the change, never the text; household entries name Vyact', () => {
    expect(activityActorLabel(null)).toBe('Vyact (automatic)');
    expect(activityActorLabel('12345678-aaaa')).toBe('12345678…');
    const row = (r: Partial<StaffAuditRow>): StaffAuditRow => ({ id: 1, at: '2026-10-25T00:00:00Z', actor_id: null, actor_email: null,
      action: 'update', target_table: 'admin_roles', target_id: 'u', changed: ['role'], detail: {}, ...r });
    expect(staffActorLabel(row({}))).toBe('Dashboard or migration');
    expect(staffActorLabel(row({ actor_email: 'super@vyact.test', actor_id: 'x' }))).toBe('super@vyact.test');
    expect(staffChangeSummary(row({ detail: { role_before: 'content', role_after: 'roles' } }))).toBe('content → roles');
    expect(staffChangeSummary(row({ action: 'insert', detail: { role_after: 'content' } }))).toBe('granted content');
    expect(staffChangeSummary(row({ target_table: 'category_classifications', target_id: 'dining', detail: { before: 'need', after: 'want' } })))
      .toBe('dining: need → want');
    expect(staffChangeSummary(row({ target_table: 'content_items', changed: ['body', 'status'],
      detail: { slug: 'x', status_before: 'draft', status_after: 'published' } }))).toBe('x (draft → published) · body, status');
    const audit = src('pages/Audit.tsx');
    expect(audit).toMatch(/const canSeeStaff = role === 'super' && serverRole === 'super';/);
    expect(audit).toMatch(/fetchStaffAudit\(200\)/);
  });

  it('Q3B-ADM-005 · MRR is shown per currency, never summed or labelled USD (ADM-14)', () => {
    expect(revenueFromMap({ USD: 12, INR: 999 })).toEqual([{ currency: 'INR', mrr: 999, arr: 11988 }, { currency: 'USD', mrr: 12, arr: 144 }]);
    expect(revenueLabel(revenueFromMap({}), 'mrr')).toBe('—');
    const dash = src('pages/Dashboard.tsx');
    expect(dash).toMatch(/revenueLabel\(revenueFromMap\(kpis\.mrrByCurrency\), 'mrr'\)/);
    expect(dash).not.toMatch(/MRR \(USD\)|kpis\?\.mrr\b/);
  });

  it('Q3B-ADM-006 · an infographic is checked before upload: PNG, JPEG or WebP, at most 5 MB (ADM-10)', () => {
    expect(infographicProblem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(infographicProblem({ type: 'image/webp', size: INFOGRAPHIC_MAX_BYTES })).toBeNull();
    expect(infographicProblem({ type: 'image/gif', size: 1000 })).toMatch(/PNG, JPEG or WebP/);
    expect(infographicProblem({ type: 'image/jpeg', size: INFOGRAPHIC_MAX_BYTES + 1 })).toMatch(/over 5 MB/);
    expect(src('lib/contentApi.ts')).toMatch(/const problem = infographicProblem\(file\);\n\s+if \(problem\) throw new Error\(problem\);/);
    expect(src('pages/Content.tsx')).not.toMatch(/accept="image\/\*"/);
  });

  it('Q3B-ADM-007 · admin previews never reach production (ADM-09, OPS-05)', () => {
    expect(previewProblem('preview', `https://${PROD_SUPABASE_REF}.supabase.co`)).toMatch(/production database/);
    expect(previewProblem('preview', undefined)).toMatch(/needs VITE_SUPABASE_URL/);
    expect(previewProblem('preview', 'https://xdbfzwltqocyljbgztmv.supabase.co')).toBeNull();
    expect(previewProblem('production', `https://${PROD_SUPABASE_REF}.supabase.co`)).toBeNull();
    expect(previewProblem(undefined, undefined)).toBeNull();
    const vercel = JSON.parse(root('vercel.json')) as { ignoreCommand: string };
    // A script, because vercel.json caps each command at 256 characters (the inline form failed every deployment).
    expect(vercel.ignoreCommand).toBe('sh scripts/ignore-build.sh');
    expect(root('scripts/ignore-build.sh')).toMatch(/^if \[ "\$VERCEL_ENV" = preview \] && \[ "\$VERCEL_GIT_COMMIT_REF" != staging \] && \[ "\$VERCEL_GIT_COMMIT_REF" != develop \]; then\n {2}echo .*; exit 0\nfi$/m);
    expect(root('vite.config.ts')).toMatch(/const problem = previewProblem\(process\.env\.VERCEL_ENV,/);
    expect(root('vite.config.js')).toMatch(/previewProblem\(process\.env\.VERCEL_ENV/);   // the file Vite loads first
    expect(src('lib/supabase.ts')).not.toMatch(new RegExp(`${PROD_SUPABASE_REF}|FALLBACK_URL|sb_publishable_`));
  });

  it('Q3B-ADM-008 · Help says what the console does today', () => {
    const help = src('pages/Help.tsx');
    expect(help).not.toMatch(/INSERT INTO admin_roles|pulse score|choose Suspend|no record of admin actions/i);
    expect(help).toMatch(/Staff role control/);
    expect(help).toMatch(/Audit Log → Staff actions/);
  });
});
