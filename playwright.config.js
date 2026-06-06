import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://127.0.0.1:3001/healthz',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        PORT: '3001',
        PUBLIC_APP_URL: 'http://127.0.0.1:5173',
        DATABASE_FILE: 'data/playwright-e2e.db',
        MAIL_CAPTURE_DIRECTORY: 'data/playwright-mail',
        API_RATE_LIMIT: '1000',
        AUTH_RATE_LIMIT: '1000',
        BACKUP_MIN_INTERVAL_MS: '0',
      },
    },
    {
      command: 'npm run dev:client -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})