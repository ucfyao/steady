import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { bootScript } from './src/theme/boot.js';

export default defineConfig({
  plugins: [
    react(),
    // Spec 012: apply the stored light or dark choice before the first paint.
    {
      name: 'steady-theme-boot',
      transformIndexHtml: () => [
        { tag: 'script', children: bootScript(), injectTo: 'head-prepend' },
      ],
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    // The API (apps/api) runs on 4000; the browser only ever talks to /api on this origin.
    proxy: { '/api': 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
