import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// esbuild (Vitest's default transform) cannot emit decorator metadata, which
// NestJS dependency injection relies on, so tests are compiled with SWC.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    // One Postgres container per test file; starting it can take a while on first pull.
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});
