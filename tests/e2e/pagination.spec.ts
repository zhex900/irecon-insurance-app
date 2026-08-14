import { expect, test } from "@playwright/test";
import { demoUsers, loginAs } from "./helpers/auth";

test.describe("pagination", () => {
  test("clients list respects page and pageSize query params", async ({
    page,
  }) => {
    await loginAs(page, demoUsers.broker);
    await page.goto("/clients?page=1&pageSize=10");
    await expect(page).toHaveURL(/pageSize=10/);
    await expect(
      page.getByRole("heading", { name: /clients/i }).first(),
    ).toBeVisible();
  });

  test("policies list accepts pageSize query", async ({ page }) => {
    await loginAs(page, demoUsers.broker);
    await page.goto("/policies?pageSize=50");
    await expect(page).toHaveURL(/pageSize=50/);
    await expect(
      page.getByRole("heading", { name: /policies/i }).first(),
    ).toBeVisible();
  });
});
