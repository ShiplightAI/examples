import { defineConfig, shiplightConfig } from 'shiplightai';
import * as path from 'path';

const STORAGE_STATE_PATH = path.join(import.meta.dirname, 'demo/.auth/storageState.json');

export default defineConfig({
  ...shiplightConfig(),
  testDir: '.',
  testMatch: ['**/*.test.ts', '**/*.yaml.spec.ts'],
  timeout: 600_000,
  expect: { timeout: 10_000 },
  retries: 0,
  projects: [
    {
      name: 'setup',
      testDir: './demo',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'demo',
      testDir: './demo',
      dependencies: ['setup'],
      use: {
        baseURL: 'https://www.saucedemo.com',
        storageState: STORAGE_STATE_PATH,
      },
    },
    {
      name: 'showcase',
      testDir: './showcase',
    },
    // Deliberately-failing fixtures that exercise the CI Failure Triage
    // pipeline. Run only by the "Triage Fixtures" workflow — keep them out of
    // the main E2E suite, or main is permanently red and a real regression
    // becomes indistinguishable from these.
    {
      name: 'triage-fixtures',
      testDir: './triage-fixtures',
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
