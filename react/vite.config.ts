import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Single source of truth for the app version shown in-app (Help & Guide):
// read package.json at build time and inline it as the global __APP_VERSION__.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173, host: true, open: true },
  build: { outDir: 'dist', sourcemap: true, target: 'esnext' },
});
