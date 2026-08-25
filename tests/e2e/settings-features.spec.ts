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
});
