// Allow Node.js types in this config file
/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";

import { authFiles } from "./tests/e2e/helpers/auth";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";

/**
 * Playwright config (Phase 7).
 * baseURL from E2E_BASE_URL; local webServer starts `npm run dev` unless E2E_SKIP_WEBSERVER=1.
 * Auth: `tests/e2e/auth.setup.ts` saves sessions under `playwright/.auth/` (see Playwright auth docs).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    // List e2e/smoke before setup — Playwright UI selects the first project by default;
    // if setup were first, the sidebar would only show auth.setup.ts (see playwright.dev/docs/test-ui-mode).
    {
      name: "e2e",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /smoke\.spec\.ts|policy-matrix\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFiles.broker,
      },
      dependencies: ["setup"],
    },
    {
      name: "policy-matrix",
      testMatch: /policy-matrix\.spec\.ts/,
      fullyParallel: true,
      workers: 2,
      timeout: 120_000,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFiles.broker,
      },
      dependencies: ["setup"],
    },
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFiles.broker,
      },
      dependencies: ["setup"],
    },
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
  ],
});
