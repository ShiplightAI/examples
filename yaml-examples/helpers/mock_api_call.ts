import type { Page } from '@playwright/test';

/**
 * Mock the fruits API to return custom data.
 * @function_id 109
 */
export async function mock_api_call(page: Page): Promise<void> {
  await page.route('*/**/api/v1/fruits', async route => {
    const json = [{ name: 'Apple', id: 21 }, { name: 'Banana', id: 22 }];
    await route.fulfill({ json });
  });
}
