// Admin v1.5.0 (ADM-09): admin/vercel.json's deploy skip starts with this preview rule, then is the shared skip.
export const ADMIN_PREVIEW_SKIP = "if [ \"$VERCEL_ENV\" = preview ] && [ \"$VERCEL_GIT_COMMIT_REF\" != staging ] && [ \"$VERCEL_GIT_COMMIT_REF\" != develop ]; then echo 'Admin previews build only on staging and develop (ADM-09)'; exit 0; fi; ";
