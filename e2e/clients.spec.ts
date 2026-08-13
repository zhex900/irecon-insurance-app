import { expect, test } from "@playwright/test";
import { demoUsers, loginAs } from "./helpers/auth";

test.describe("clients", () => {
  test("create client draft, save, appear in list", async ({ page }) => {
    await loginAs(page, demoUsers.broker);

    const stamp = Date.now();
    const registeredName = `E2E Client ${stamp}`;
    const tradingName = `E2E Trade ${stamp}`;

    await page.goto("/clients");
    await page.getByRole("button", { name: /new client/i }).click();
    await expect(page).toHaveURL(/\/clients\/[^/]+\/edit/);

    await page.getByLabel(/registered name/i).fill(registeredName);
    await page.getByLabel(/trading name/i).fill(tradingName);

    // Account manager + AR are required for complete save — pick first options if selects exist.
    const accountManager = page.getByLabel(/account manager/i);
    if (await accountManager.count()) {
      await accountManager.click();
      const option = page.getByRole("option").first();
      if (await option.count()) await option.click();
    }

    const ar = page.getByLabel(/authorised representative/i);
    if (await ar.count()) {
      await ar.click();
      const option = page.getByRole("option").first();
      if (await option.count()) await option.click();
    }

    const save = page.getByRole("button", { name: /^save$/i });
    await save.click();

    // Prefer detail URL; otherwise soft-assert via list search for the draft name.
    await Promise.race([
      page.waitForURL(/\/clients\/\d+$/, { timeout: 15_000 }).catch(() => null),
      page
        .waitForURL(/\/clients\/\d+\/edit/, { timeout: 15_000 })
        .catch(() => null),
    ]);

    await page.goto(`/clients?q=${encodeURIComponent(registeredName)}`);
    await expect(
      page.getByText(registeredName).or(page.getByText(tradingName)).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
