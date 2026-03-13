import type { Page } from '@playwright/test';

/**
 * Get the number of items currently in the shopping cart.
 * Returns 0 if the cart badge is not visible.
 * @function_id 26
 */
export async function getCartCount(page: Page): Promise<number> {
  const badge = page.locator('.shopping_cart_badge');
  if (await badge.isVisible()) {
    const text = await badge.textContent();
    return parseInt(text ?? '0', 10);
  }
  return 0;
}

/**
 * Remove all items from the cart by visiting the cart page
 * and clicking each "Remove" button.
 * @function_id 27
 */
export async function clearCart(page: Page): Promise<void> {
  await page.goto('/cart.html');
  const removeButtons = page.locator('button.cart_button');
  const count = await removeButtons.count();
  for (let i = count - 1; i >= 0; i--) {
    await removeButtons.nth(i).click();
  }
}

/**
 * Verify the cart badge shows the expected item count.
 * Pass expectedCount as a number and optionally a custom message.
 * @function_id 28
 */
export async function verifyCartCount(
  page: Page,
  expectedCount: number,
  message: string,
): Promise<void> {
  const badge = page.locator('.shopping_cart_badge');
  if (expectedCount === 0) {
    if (await badge.isVisible()) {
      throw new Error(message || 'Expected cart to be empty');
    }
    return;
  }
  const text = await badge.textContent();
  const actual = parseInt(text ?? '0', 10);
  if (actual !== expectedCount) {
    throw new Error(message || `Expected ${expectedCount} items, got ${actual}`);
  }
}
