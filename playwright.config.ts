import { defineConfig, devices } from '@playwright/test';

// Windows wrangler proxy bug workaround: use TEST_PORT env var if set
const port = process.env.TEST_PORT || '8787';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only start webServer if not using custom TEST_PORT
  ...(process.env.TEST_PORT ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:8787',
      reuseExistingServer: true,
      timeout: 60000,
    },
  }),
});
