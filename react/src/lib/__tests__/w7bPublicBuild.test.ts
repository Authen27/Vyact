// W7b (v10.81.0) — public site and build config from the 2026-10-04 audit (batch C). Each case is named
// after its finding. Config is pinned by reading the files the platform reads.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
// @ts-expect-error — plain .mjs build script, no types
import { findSourceMapLeaks } from '../../../scripts/assert-no-sourcemaps.mjs';

const repo = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(repo, p), 'utf8');

describe('W7b · public site and build config', () => {
  it('W7b-PUB07-001 · the deploy skip compares with the last deployed commit, and builds when unsure (FE-PUB-07, OPS-13)', () => {
    for (const f of ['react/vercel.json', 'admin/vercel.json']) {
      const cmd = JSON.parse(read(f)).ignoreCommand as string;
      // A push ending in a docs-only commit used to skip the code commits before it (HEAD^..HEAD only).
      expect(cmd, f).not.toMatch(/HEAD\^/);
      // Empty variable (first deploy, redeploy) → `[ -n ]` fails → non-zero → Vercel builds.
      expect(cmd, f).toMatch(/^\[ -n "\$VERCEL_GIT_PREVIOUS_SHA" \] && git diff --quiet "\$VERCEL_GIT_PREVIOUS_SHA" HEAD -- \. /);
      expect(cmd, f).toContain(`':!*.md' ':!**/*.md' ':!docs'`);
    }
  });

  it('W7b-GATE03-001 · production builds publish no source maps, and the build gate catches one (GATE-03)', () => {
    expect(read('react/vite.config.ts')).toMatch(/build: \{ outDir: 'dist', sourcemap: false,/);
    expect(JSON.parse(read('react/package.json')).scripts.postbuild).toMatch(/node scripts\/assert-no-sourcemaps\.mjs/);
    const dist = mkdtempSync(join(tmpdir(), 'w7b-dist-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'assets', 'index-a1.js'), 'console.log(1);\n');
    writeFileSync(join(dist, 'assets', 'index-a1.css'), 'body{}\n');
    expect(findSourceMapLeaks(dist)).toEqual([]);
    writeFileSync(join(dist, 'assets', 'app-b2.js'), 'x();\n//# sourceMappingURL=app-b2.js.map\n');
    writeFileSync(join(dist, 'assets', 'app-b2.js.map'), '{}');
    expect(findSourceMapLeaks(dist).sort()).toEqual([
      join('assets', 'app-b2.js') + ' (sourceMappingURL)',
      join('assets', 'app-b2.js.map') + ' (map file)',
    ].sort());
  });

  it('W7b-PLT11-001 · no stale root vercel.json, self-dependency, @supabase/ssr or Next.js scaffold (FE-PLT-11)', () => {
    // Every Vercel project (vyact, vyact-demo, vyact-admin) builds from react/ or admin/; the root file was
    // read by none and described an older routing.
    expect(existsSync(resolve(repo, 'vercel.json'))).toBe(false);
    const pkg = JSON.parse(read('react/package.json'));
    expect(pkg.dependencies).not.toHaveProperty('vyact-react');
    expect(pkg.dependencies).not.toHaveProperty('@supabase/ssr');
    expect(read('react/package-lock.json')).not.toMatch(/"node_modules\/@supabase\/ssr"|"node_modules\/vyact-react"/);
    for (const f of ['react/page.tsx', 'react/utils/supabase/server.ts', 'react/utils/supabase/client.ts', 'react/utils/supabase/middleware.ts']) {
      expect(existsSync(resolve(repo, f)), f).toBe(false);
    }
  });
});
