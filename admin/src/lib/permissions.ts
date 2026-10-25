// ADM-07 (admin v1.5.0; owner, 20 Oct 2026: "narrow the pages"). ONE table of which staff tier opens which page,
// read by the sidebar (Layout) and the routes (App). A page is offered only to the tiers the server lets make its
// calls (the consumer repo's authzMatrixSql pins those tiers):
//   dashboard     admin_dashboard_kpis, admin_weekly_trend                       → roles tier (super, roles)
//   users         admin_list_users_page, admin_people_summary, grant/revoke     → roles tier (role changes: super)
//   households    admin_list_households, admin_people_summary                   → roles tier
//   audit         admin_activity_feed (roles tier); Staff actions: admin_staff_audit (super)
//   intelligence  admin_ai_usage_summary, admin_ai_feedback_summary             → content tier (super, content)
//   content       content_items and the infographics bucket                     → content tier
//   subscriptions, settings                                                      → super
// Before v1.5.0 a content admin saw a Dashboard the server refused, and a roles admin an Intelligence page.
import type { AdminRole } from '../types';

export const PAGE_ROLES = {
  dashboard: ['super', 'roles'],
  users: ['super', 'roles'],
  households: ['super', 'roles'],
  subscriptions: ['super'],
  content: ['super', 'content'],
  audit: ['super', 'roles'],
  intelligence: ['super', 'content'],
  settings: ['super'],
  help: ['super', 'roles', 'content'],
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminPage = keyof typeof PAGE_ROLES;

export function canAccessPage(role: AdminRole | null, page: string): boolean {
  if (page === 'help') return true;
  if (!role) return false;
  const tiers = (PAGE_ROLES as Record<string, readonly AdminRole[]>)[page];
  return !!tiers && tiers.includes(role);
}

/** Where a tier lands: the Dashboard for the roles tier, Learn content for the content tier. */
export function homePath(role: AdminRole | null): string {
  return canAccessPage(role, 'dashboard') ? '/' : canAccessPage(role, 'content') ? '/content' : '/help';
}
