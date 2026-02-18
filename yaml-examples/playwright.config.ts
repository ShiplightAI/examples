import { defineConfig } from '@playwright/test';
import { shiplightConfig } from 'shiplightai';

export default defineConfig({
  ...shiplightConfig(),

  timeout: 120_000,

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
  },
});
