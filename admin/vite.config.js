import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';
import { previewProblem } from './previewGuard.js';
// v1.4.1 — the version shown on the sign-in screen comes from package.json at build
// time (same idea as react/vite.config.ts). It was hard-coded as "v1.0.4".
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    // v1.5.0 (ADM-09): a preview build never points at production (previewGuard.ts).
    var env = loadEnv(mode, process.cwd(), 'VITE_');
    var problem = previewProblem(process.env.VERCEL_ENV, (_b = process.env.VITE_SUPABASE_URL) !== null && _b !== void 0 ? _b : env.VITE_SUPABASE_URL);
    if (problem)
        throw new Error(problem);
    return {
        plugins: [react()],
        server: { port: 5174, host: true, open: true },
        // W8c (audit ADM-13): no source maps of the privileged console in production;
        // scripts/assert-no-sourcemaps.mjs fails the build if one comes back.
        build: { outDir: 'dist', sourcemap: false, target: 'esnext' },
        define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    };
});
