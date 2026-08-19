import { expect, test } from "@playwright/test";

import { demoUsers, loginAs } from "./helpers/auth";

/**
 * Post-deploy smoke subset: login, open client list, open policy list.
 * Run with: npm run test:smoke
 */
test.describe("smoke", () => {
  test("login and open core lists", async ({ page }) => {
    await loginAs(page, demoUsers.broker);
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
