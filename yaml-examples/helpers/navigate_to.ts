import type { Page } from '@playwright/test';

/**
 * Navigate to a URL with domcontentloaded wait.
 * @function_id 105
 */
export async function navigate_to(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}
