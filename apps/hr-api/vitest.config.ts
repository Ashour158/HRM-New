import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '{src,test}/**/*.{test,spec}.js'],
  },
});
