import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts: the React Router plugin is not needed (or wanted) in unit tests.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
