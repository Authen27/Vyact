// Vyact — the production build, as one command (v10.137.0; supply-chain hardening, owner decision 26 Oct 2026).
//
// react/.npmrc sets `ignore-scripts=true`, so a package's install script never runs on a developer's machine, in CI or
// on Vercel (the 2026 npm worms spread through them). With it, npm also skips every pre/post hook of our own scripts,
// "postbuild" included. So the steps that ran as "postbuild" run here, in the same order, after `vite build`:
//   check-env → tsc -b → vite build → landing pre-render → no source maps → preview isolated → entry budget.
// Arguments after `--` go to `vite build` only, as before: Playwright runs `npm run build -- --mode test`, and the
// pre-render reads the mode from VITE_BUILD_MODE (playwright.config.ts). Any step that fails stops the build.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = (name) => path.join(root, 'node_modules', '.bin', name);

/** The build, step by step; `viteArgs` are the arguments given after `--`. */
export function buildSteps(viteArgs = []) {
  return [
    ['node', ['check-env.js']],
    [bin('tsc'), ['-b']],
    [bin('vite'), ['build', ...viteArgs]],
    ['node', ['scripts/prerender-landing.mjs']],
    ['node', ['scripts/assert-no-sourcemaps.mjs']],
    ['node', ['scripts/assert-preview-isolated.mjs']],
    ['node', ['scripts/assert-bundle-budget.mjs']],
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [cmd, args] of buildSteps(process.argv.slice(2))) {
    // On Windows the .bin entries are .cmd files, which need a shell; nothing here is user input.
    const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) {
      console.error(`build: ${path.basename(cmd)} ${args.join(' ')} failed${r.error ? ` (${r.error.message})` : ''}`);
      process.exit(r.status ?? 1);
    }
  }
}
