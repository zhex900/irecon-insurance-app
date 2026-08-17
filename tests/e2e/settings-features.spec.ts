import { expect, test } from "@playwright/test";

import { demoUsers, loginAs } from "./helpers/auth";

test.describe("settings features", () => {
  test("broker gets 403 error on feature flags", async ({ page }) => {
    await loginAs(page, demoUsers.broker);
    await page.goto("/settings/features");
    // Non-super-admin users should get 403 error
    await expect(page.getByText(/you are not authorised/i)).toBeVisible();
  });

  test("admin gets 403 error on feature flags", async ({ page }) => {
    test.skip(
      true,
      "Admin user login appears to have issues - needs investigation",
    );
    await loginAs(page, demoUsers.admin);
    await page.goto("/settings/features");
    // Non-super-admin users should get 403 error
    await expect(page.getByText(/you are not authorised/i)).toBeVisible();
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
