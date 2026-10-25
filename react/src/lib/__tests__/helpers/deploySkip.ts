// Admin v1.5.0 (ADM-09): admin/vercel.json's deploy skip runs admin/scripts/ignore-build.sh: the preview rule, then the
// shared skip (react/vercel.json's ignoreCommand, as its last line). It is a script because Vercel caps every
// vercel.json command at 256 characters (VERCEL_COMMAND_MAX).
export const ADMIN_IGNORE_COMMAND = 'sh scripts/ignore-build.sh';
export const ADMIN_IGNORE_SCRIPT = 'admin/scripts/ignore-build.sh';
export const VERCEL_COMMAND_MAX = 256;
