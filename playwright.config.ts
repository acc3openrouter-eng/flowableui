import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against a running Flowable UI 6.8.x (see e2e/README.md).
 * By default the dev server is started and proxies /flowable-ui to http://localhost:8080.
 */
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  // The tests share one Flowable server, so they run one at a time.
  workers: 1,
  forbidOnly: !!process.env['CI'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env['E2E_CHROMIUM'] || undefined },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/user.json' },
    },
  ],
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        command: 'npm start',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
