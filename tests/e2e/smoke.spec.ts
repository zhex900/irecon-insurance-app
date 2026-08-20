import { expect, test } from "@playwright/test";

/**
 * Post-deploy smoke subset: open client and policy lists (broker session from setup).
 * Run with: npm run test:smoke
 */
test.describe("smoke", () => {
  test("authenticated broker can open core lists", async ({ page }) => {
    await page.goto("/clients");
    await expect(
      page.getByRole("heading", { name: /clients/i }).first(),
    ).toBeVisible();
    await page.goto("/policies");
    await expect(
      page.getByRole("heading", { name: /policies/i }).first(),
    ).toBeVisible();
  });
});
