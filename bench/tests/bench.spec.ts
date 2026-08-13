import { test, expect } from "@playwright/test";

// 32 structurally identical scenarios so the suite parallelizes across
// workers the way a real feature suite does. Each exercises rendering,
// filtering, form validation, and a CPU-heavy sort in the app's JS.
for (let i = 0; i < 32; i++) {
  test(`scenario ${String(i).padStart(2, "0")}`, async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#title")).toHaveText("Bench Fixture");

    // Render 3000 rows and assert the count.
    await page.click("#render");
    await expect(page.locator("#count")).toHaveText("3000");
    await expect(page.locator("#rows tr")).toHaveCount(3000);

    // Filter narrows deterministically: "item-1" prefix-matches 1, 10-19,
    // 100-199, 1000-1999 = 1111 rows.
    await page.fill("#filter", `item-1`);
    await expect(page.locator("#count")).toHaveText("1111");
    await page.fill("#filter", `item-${i}9`);
    await expect(page.locator("#count")).not.toHaveText("3000");

    // Form validation, invalid then valid.
    await page.click("#tab-b-btn");
    await page.fill("#name", `user-${i}`);
    await page.fill("#email", "not-an-email");
    await page.click("#submit");
    await expect(page.locator("#form-status")).toHaveText("invalid");
    await page.fill("#email", `user-${i}@example.com`);
    await page.click("#submit");
    await expect(page.locator("#form-status")).toHaveText(`saved user-${i}`);

    // CPU-heavy path.
    await page.click("#tab-c-btn");
    await page.click("#sort");
    await expect(page.locator("#sort-result")).toContainText("sorted:", {
      timeout: 60_000,
    });

    // Back to the list, verify state survived the tab round-trip.
    await page.click("#tab-a-btn");
    await expect(page.locator("#rows tr").first()).toBeVisible();
  });
}
