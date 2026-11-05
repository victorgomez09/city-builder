import { defineConfig } from 'vite';
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
  server: {
    port: 3000,
    headers: {
      // Cabeceras necesarias si se usa SharedArrayBuffer entre Main Thread y Workers
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
  },
});
