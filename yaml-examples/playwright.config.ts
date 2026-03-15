import { defineConfig } from '@playwright/test';
import { shiplightConfig } from 'shiplightai';
import * as path from 'path';

const STORAGE_STATE_PATH = path.join(import.meta.dirname, 'demo/.auth/storageState.json');

export default defineConfig({
  ...shiplightConfig(),
  testDir: '.',
  testMatch: ['**/*.test.ts', '**/*.yaml.spec.ts'],
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: 0,
  projects: [
    {
      name: 'setup',
      testDir: './demo',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'default',
      dependencies: ['setup'],
      use: {
        storageState: STORAGE_STATE_PATH,
      },
    },
  ],
  use: {
    baseURL: 'https://www.saucedemo.com',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  },
});
