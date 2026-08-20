import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Page } from "@playwright/test";

const helpersDir = path.dirname(fileURLToPath(import.meta.url));

/** Persisted browser state — gitignored; see `tests/e2e/auth.setup.ts`. */
export const authDir = path.resolve(helpersDir, "../../../playwright/.auth");

/** Relative paths for `test.use({ storageState })` and `playwright.config.ts`. */
export const authFiles = {
  broker: "playwright/.auth/broker.json",
  admin: "playwright/.auth/admin.json",
  superAdmin: "playwright/.auth/super-admin.json",
} as const;

export const authPaths = {
  broker: path.join(authDir, "broker.json"),
  admin: path.join(authDir, "admin.json"),
  superAdmin: path.join(authDir, "super-admin.json"),
} as const;

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
    email: process.env.E2E_SUPER_ADMIN_EMAIL?.trim() ?? "",
    password: process.env.E2E_SUPER_ADMIN_PASSWORD?.trim() ?? "password123",
  },
} as const;

export type DemoUser = { email: string; password: string };

/** UI login used by auth setup and auth.spec (not needed when using `storageState`). */
export async function performLogin(page: Page, user: DemoUser) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/^password$/i).fill(user.password);

  const signIn = page.getByRole("button", { name: /sign in/i });
  await expect(signIn).toBeEnabled({ timeout: 15_000 });
  await signIn.click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

export async function loginAs(page: Page, user: DemoUser) {
  await performLogin(page, user);
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function saveAuthState(page: Page, filePath: string) {
  await page.context().storageState({ path: filePath });
}

export async function logout(page: Page) {
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
