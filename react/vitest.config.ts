import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: { 'https://esm.sh/@supabase/supabase-js@2.45.0': require.resolve('@supabase/supabase-js') },
  },
  test: {
    environment: 'node',
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/lib/__tests__/askVyactLive.test.ts'],
    pool: 'threads',
    maxWorkers: 2,
    // v10.131.0: many cases read the whole source tree or every migration from disk (design, docs and privacy
    // scans). Cold, on a loaded Windows machine, those passed the 5-second default; the time is disk, not the
    // code under test. A hung test still fails, after 15 seconds.
    testTimeout: 15_000,
    globals: false,
  },
});
