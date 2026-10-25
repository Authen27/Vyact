// Admin v1.5.0 — how the Audit Log names actors and staff changes (kept apart from the page so it can be tested).
import type { StaffAuditRow } from './adminApi';

/** The actor of a household entry; none means the server did it on a schedule. */
export function activityActorLabel(actorId: string | null): string {
  return actorId ? actorId.slice(0, 8) + '…' : 'Vyact (automatic)';
}

/** The actor of a staff change; none means the Supabase dashboard or a migration. */
export function staffActorLabel(row: Pick<StaffAuditRow, 'actor_id' | 'actor_email'>): string {
  return row.actor_email ?? (row.actor_id ? row.actor_id.slice(0, 8) + '…' : 'Dashboard or migration');
}

export const STAFF_TABLE_LABEL: Record<StaffAuditRow['target_table'], string> = {
  admin_roles: 'Staff role', content_items: 'Learn content', category_classifications: 'Needs / wants', ai_model_configs: 'AI model setting',
};

/** One line on what a staff change did, from its small detail (never the text). */
export function staffChangeSummary(row: StaffAuditRow): string {
  const d = row.detail as Record<string, unknown>;
  const s = (k: string) => (d[k] === undefined || d[k] === null ? '' : String(d[k]));
  switch (row.target_table) {
    case 'admin_roles':
      return row.action === 'insert' ? `granted ${s('role_after')}` : row.action === 'delete' ? `revoked ${s('role_before')}` : `${s('role_before')} → ${s('role_after')}`;
    case 'category_classifications':
      return row.action === 'update' ? `${row.target_id}: ${s('before')} → ${s('after')}` : `${row.target_id} ${row.action === 'insert' ? 'added' : 'removed'}`;
    case 'content_items': {
      const status = s('status_before') && s('status_after') && s('status_before') !== s('status_after') ? ` (${s('status_before')} → ${s('status_after')})` : '';
      return `${s('slug')}${status}${row.changed.length ? ` · ${row.changed.join(', ')}` : ''}`;
    }
    case 'ai_model_configs':
      return `${s('provider')} ${s('model')}${row.changed.length ? ` · ${row.changed.join(', ')}` : ''}`;
  }
}
