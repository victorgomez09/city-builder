import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
});
