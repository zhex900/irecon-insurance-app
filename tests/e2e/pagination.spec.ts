import { expect, test } from "@playwright/test";

test.describe("pagination", () => {
  test("clients list respects page and pageSize query params", async ({
    page,
  }) => {
    await page.goto("/clients?page=1&pageSize=10");
    await expect(page).toHaveURL(/pageSize=10/);
    await expect(
      page.getByRole("heading", { name: /clients/i }).first(),
    ).toBeVisible();
  });

  test("policies list accepts pageSize query", async ({ page }) => {
    await page.goto("/policies?pageSize=50");
    await expect(page).toHaveURL(/pageSize=50/);
    await expect(
      page.getByRole("heading", { name: /policies/i }).first(),
    ).toBeVisible();
  });
});
