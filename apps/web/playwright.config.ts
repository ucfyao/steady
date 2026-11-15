import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

/**
 * End-to-end tests (Spec 004) against the real API and Postgres. Run `pnpm bootstrap`
 * first (database and migrations); Playwright starts the API and the web app.
 */
export default defineConfig({
  testDir: 'e2e',
  // A real session takes about 2.5 minutes of trials; practice and probes add more.
  timeout: 6 * 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: CI,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @steady/api build && pnpm --filter @steady/api start',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @steady/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});
