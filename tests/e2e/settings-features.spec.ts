import { expect, test } from "@playwright/test";

import { authFiles } from "./helpers/auth";

test.describe("settings features", () => {
  test("broker gets 403 error on feature flags", async ({ page }) => {
    await page.goto("/settings/features");
    await expect(page.getByText(/you are not authorised/i)).toBeVisible();
  });

  test.describe("admin", () => {
    test.use({ storageState: authFiles.admin });

    test("admin gets 403 error on feature flags", async ({ page }) => {
      await page.goto("/settings/features");
      await expect(page.getByText(/you are not authorised/i)).toBeVisible();
    });
  });

  // test.describe.skip(
  //   !demoUsers.superAdmin.email,
  //   "Set E2E_SUPER_ADMIN_EMAIL to exercise feature toggle",
  //   () => {
  //     test.use({ storageState: authFiles.superAdmin });

  //     test("super-admin can toggle a feature", async ({ page }) => {
  //       await page.goto("/settings/features");
  //       await expect(
  //         page.getByRole("heading", { name: /features/i }),
  //       ).toBeVisible();

  //       const checkbox = page.getByRole("checkbox").first();
  //       await expect(checkbox).toBeVisible();
  //       const before = await checkbox.isChecked();
  //       await checkbox.click();
  //       if ((await checkbox.isChecked()) !== before) {
  //         await checkbox.click();
  //       }
  //     });
  //   },
  // );
});
