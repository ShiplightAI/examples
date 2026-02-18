import type { Page } from '@playwright/test';

/**
 * Get the number of items currently in the shopping cart.
 * Returns 0 if the cart badge is not visible.
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
 */
export async function clearCart(page: Page): Promise<void> {
  await page.goto('/cart.html');
  const removeButtons = page.locator('button.cart_button');
  const count = await removeButtons.count();
  for (let i = count - 1; i >= 0; i--) {
    await removeButtons.nth(i).click();
  }
}
