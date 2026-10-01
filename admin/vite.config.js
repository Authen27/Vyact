import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';
// v1.4.1 — the version shown on the sign-in screen comes from package.json at build
// time (same idea as react/vite.config.ts). It was hard-coded as "v1.0.4".
export default defineConfig({
    plugins: [react()],
    server: { port: 5174, host: true, open: true },
    build: { outDir: 'dist', sourcemap: true, target: 'esnext' },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
