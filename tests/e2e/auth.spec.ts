import { expect, test } from "@playwright/test";

import { demoUsers, loginAs, logout } from "./helpers/auth";

// Exercises login/logout — must not reuse saved storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("auth", () => {
  test("login then logout", async ({ page }) => {
    await loginAs(page, demoUsers.broker);
    await logout(page);
  });

  test("unauthenticated users are sent to login", async ({ page }) => {
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/login/);
  });

  test("invalid credentials show an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(demoUsers.broker.email);
    await page.getByLabel(/^password$/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(
      page.getByText(/invalid|password|failed/i).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
