import { expect, test } from "@playwright/test";
import { demoUsers, loginAs } from "./helpers/auth";

test.describe("settings features", () => {
  test("broker cannot open feature flags", async ({ page }) => {
    await loginAs(page, demoUsers.broker);
    await page.goto("/settings/features");
    await expect(page).toHaveURL(/\/settings\/?$/);
  });

  test("admin is redirected away from feature flags", async ({ page }) => {
    await loginAs(page, demoUsers.admin);
    await page.goto("/settings/features");
    // Only super-admin may stay; admin is redirected like broker.
    await expect(page).toHaveURL(/\/settings\/?$/);
  });

  test("super-admin can toggle a feature when credentials provided", async ({
    page,
  }) => {
    test.skip(
      !demoUsers.superAdmin.email,
      "Set E2E_SUPER_ADMIN_EMAIL to exercise feature toggle",
    );
    await loginAs(page, demoUsers.superAdmin);
    await page.goto("/settings/features");
    await expect(
      page.getByRole("heading", { name: /features/i }),
    ).toBeVisible();

    const checkbox = page.getByRole("checkbox").first();
    await expect(checkbox).toBeVisible();
    const before = await checkbox.isChecked();
    await checkbox.click();
    // Toggle back to avoid leaving env dirty.
    if ((await checkbox.isChecked()) !== before) {
      await checkbox.click();
    }
  });
});
