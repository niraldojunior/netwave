import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
