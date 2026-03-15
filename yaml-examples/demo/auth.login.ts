/**
 * Parameterized login function for per-test accounts (Case 3).
 *
 * When a test declares `use: { account: { auth_login: './demo/auth.login.ts', ... } }`,
 * the Shiplight fixture imports this module and calls login() with the credentials.
 * The login function owns the full lifecycle: login, caching, and expiration.
 *
 * Compare with auth.setup.ts which handles the shared project-level login (Case 1 & 2).
 */

import { chromium, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export async function login(account: Record<string, unknown>): Promise<string> {
  const stateFile = path.join('.auth', `${account.username}.json`);

  // Return cached state if it exists
  if (fs.existsSync(stateFile)) return stateFile;

  // Perform login
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill(account.username as string);
  await page.getByPlaceholder('Password').fill(account.password as string);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Products')).toBeVisible();

  // Cache storageState (cookies + localStorage + IndexedDB)
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  await context.storageState({ path: stateFile, indexedDB: true });
  await browser.close();

  return stateFile;
}
