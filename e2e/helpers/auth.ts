import { expect, type Page } from "@playwright/test";

export const demoUsers = {
  broker: {
    email: process.env.E2E_BROKER_EMAIL ?? "broker@demo.local",
    password: process.env.E2E_BROKER_PASSWORD ?? "password123",
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@demo.local",
    password: process.env.E2E_ADMIN_PASSWORD ?? "password123",
  },
  superAdmin: {
    email: process.env.E2E_SUPER_ADMIN_EMAIL ?? "",
    password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? "password123",
  },
} as const;

export async function loginAs(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/login");
  await waitForTurnstileIfPresent(page);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/^password$/i).fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** When Turnstile is configured, wait for the hidden token before submit. */
export async function waitForTurnstileIfPresent(page: Page) {
  const widget = page.locator("[data-turnstile-widget]");
  try {
    await widget.waitFor({ state: "visible", timeout: 3000 });
    await page.waitForFunction(
      () => {
        const input = document.querySelector(
          'input[name="cf-turnstile-response"]',
        );
        return input instanceof HTMLInputElement && input.value.length > 0;
      },
      { timeout: 15_000 },
    );
  } catch {
    // Turnstile not enabled for this environment.
  }
}

export async function logout(page: Page) {
  // Prefer an accessible logout control; fall back to direct navigation.
  const logoutLink = page.getByRole("link", { name: /log ?out|sign out/i });
  if (await logoutLink.count()) {
    await logoutLink.first().click();
  } else {
    await page.goto("/logout");
  }
  await expect(page).toHaveURL(/\/login/);
}

/** Intercept Resend-backed document email API for deterministic e2e. */
export async function mockResendEmailApi(page: Page) {
  await page.route("**/api/policies/*/email-documents", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        resendId: "e2e_mock_resend",
        attachmentCount: 1,
      }),
    });
  });
}
