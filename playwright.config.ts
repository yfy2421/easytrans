import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '.output/chrome-mv3');
const CHROME_PATH = process.env.CHROME_EXECUTABLE_PATH;

export const USER_DATA_BASE = path.resolve(__dirname, '.playwright-user-data');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 1,
  workers: 1, // Extension tests must run serially — single user data dir
  use: {
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        launchOptions: {
          executablePath: CHROME_PATH,
          args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
          // Use persistent context so extension stays loaded across pages
          // Note: this is configured per-worker in fixtures.ts
        },
      },
    },
  ],
});
