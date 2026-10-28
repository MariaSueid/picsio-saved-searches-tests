import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Load PICSIO_EMAIL / PICSIO_PASSWORD from .env if it exists (Node 20.12+ built-in, no dotenv needed)
if (fs.existsSync('.env')) process.loadEnvFile('.env');

export const STORAGE_STATE = 'playwright/.auth/user.json';

export default defineConfig({
  testDir: './tests',
  // Tests share one Pics.io account, so they run one at a time to avoid interfering with each other
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'https://pics.io',
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    // More browsers can be added the same way, e.g. devices['Desktop Firefox'] / devices['Desktop Safari']
  ],
});
