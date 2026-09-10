export function canAccessPage(role: 'super' | 'roles' | 'content' | null, page: string): boolean {
  if (page === 'help') return true;
  if (role === 'super') return true;
  if (role === 'roles') return ['dashboard', 'users', 'households', 'audit', 'intelligence'].includes(page);
  if (role === 'content') return ['dashboard', 'content', 'intelligence'].includes(page);
  return false;
}