import { expect, test } from "@playwright/test";

test.describe("clients", () => {
  test("create client draft, save, appear in list", async ({ page }) => {
    const stamp = Date.now();
    const registeredName = `E2E Client ${stamp}`;
    const tradingName = `E2E Trade ${stamp}`;

    await page.goto("/clients");
    await page.getByRole("button", { name: /new client/i }).click();
    await expect(page).toHaveURL(/\/clients\/[^/]+\/edit/);

    await page
      .getByRole("textbox", { name: "Registered Name" })
      .fill(registeredName);
    await page.getByRole("textbox", { name: "Trading Name" }).fill(tradingName);

    await page.getByRole("textbox", { name: "ABN" }).fill("12345678901");
    await page.getByRole("textbox", { name: "Email" }).fill("test@test.com");
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

    await page.goto(`/clients?q=${encodeURIComponent(registeredName)}`);
    await expect(
      page.getByText(registeredName).or(page.getByText(tradingName)).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
