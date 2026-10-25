// The parked pipeline's tests: not part of the default run (react/vitest.config.ts includes react/src only).
// Run them with `npm --prefix react run test:parked`.
export default {
  test: {
    root: new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
};
