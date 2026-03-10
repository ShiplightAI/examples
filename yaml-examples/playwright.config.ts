import { defineConfig } from '@playwright/test';
import { shiplightConfig } from 'shiplightai';

export default defineConfig({
  ...shiplightConfig(),

  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['html', { open: 'never', outputFolder: 'shiplight-report' }]],

  projects: [
    {
      name: 'demo-setup',
      testDir: './demo',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'demo',
      testDir: './demo',
      dependencies: ['demo-setup'],
      use: {
        baseURL: 'https://www.saucedemo.com',
        storageState: './demo/.auth/storage-state.json',
      },
    },
  ],

  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  },
});
