import { expect, type Page } from "@playwright/test";

export const demoUsers = {
  broker: {
    email: "zhex900+broker@gmail.com",
    password: "broker@demo.local",
  },
  admin: {
    email: "zhex900+admin@gmail.com",
    password: "broker@demo.local",
  },
  superAdmin: {
    email: "",
    password: "password123",
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

/**
 * Intercept Resend-backed document email API for deterministic e2e.
 *
 * Also neutralizes the app's `OfflineDialog` connectivity probe
 * (`useNetworkStatus` → `fetch("/favicon.ico")`), which otherwise fails with
 * "TypeError: Failed to fetch" as soon as *any* `page.route()` handler is
 * registered on the page (a Playwright/CDP Fetch-domain interception quirk,
 * not an app bug — the probe itself is fine outside of network interception).
 * Without this, the resulting "No internet connection" dialog overlay blocks
 * every subsequent click in the test.
 */
export async function mockResendEmailApi(page: Page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      if (url.includes("/favicon.ico")) {
        return Promise.resolve(new Response("", { status: 200 }));
      }
      return originalFetch(input, init);
    };
  });
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
