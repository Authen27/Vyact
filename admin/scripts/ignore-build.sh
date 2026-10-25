#!/bin/sh
# Vercel's Ignored Build Step for vyact-admin (admin v1.5.0, ADM-09), run from admin/ (the project's root).
# Exit 0 skips the build, exit 1 builds; any other code is a deployment Error, so nothing else may escape.
# It lives here because vercel.json allows at most 256 characters per command: the inline form (421) made Vercel
# refuse every admin deployment as invalid configuration.

# 1. A preview builds only from staging or develop, whose Preview env names vyact-test. Every other branch is
#    skipped; previewGuard.ts fails a preview build that still points at production.
if [ "$VERCEL_ENV" = preview ] && [ "$VERCEL_GIT_COMMIT_REF" != staging ] && [ "$VERCEL_GIT_COMMIT_REF" != develop ]; then
  echo 'Admin previews build only on staging and develop (ADM-09)'; exit 0
fi

# 2. The shared skip, exactly react/vercel.json's ignoreCommand: nothing but docs changed since the last deployment.
if [ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':!*.md' ':!**/*.md' ':!docs'; then exit 0; else exit 1; fi
