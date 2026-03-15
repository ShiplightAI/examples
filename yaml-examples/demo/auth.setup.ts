/**
 * Shared account login (Case 1 & 2).
 *
 * Case 1 — single account: hardcode credentials or read from env.
 * Case 2 — multiple accounts: select via TEST_ACCOUNT env var at runtime.
 *
 * Run with: TEST_ACCOUNT=problem npx shiplight test
 * Default:  standard_user
 */

import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const STORAGE_STATE_PATH = path.join(import.meta.dirname, '.auth/storageState.json');

const ACCOUNTS: Record<string, { username: string; password: string }> = {
  standard: { username: 'standard_user', password: 'secret_sauce' },
  problem: { username: 'problem_user', password: 'secret_sauce' },
  performance: { username: 'performance_glitch_user', password: 'secret_sauce' },
};

setup('authenticate', async ({ page }) => {
  const accountName = process.env.TEST_ACCOUNT ?? 'standard';
  const account = ACCOUNTS[accountName];
  if (!account) {
    throw new Error(`Unknown TEST_ACCOUNT "${accountName}". Available: ${Object.keys(ACCOUNTS).join(', ')}`);
  }

  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill(account.username);
  await page.getByPlaceholder('Password').fill(account.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Products')).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
