import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, './src/core'),
      '@render': resolve(__dirname, './src/render'),
      '@worker': resolve(__dirname, './src/worker'),
      '@ui': resolve(__dirname, './src/ui'),
      '@platform': resolve(__dirname, './src/platform'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    benchmark: {
      include: ['tests/**/*.bench.ts'],
    },
  },
});
