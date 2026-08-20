import fs from "node:fs";

import { test as setup } from "@playwright/test";

import {
  authDir,
  authPaths,
  demoUsers,
  performLogin,
  saveAuthState,
} from "./helpers/auth";

setup.describe.configure({ mode: "serial" });

setup.beforeAll(() => {
  fs.mkdirSync(authDir, { recursive: true });
});

setup("authenticate broker", async ({ page }) => {
  await performLogin(page, demoUsers.broker);
  await saveAuthState(page, authPaths.broker);
});

setup("authenticate admin", async ({ page }) => {
  await performLogin(page, demoUsers.admin);
  await saveAuthState(page, authPaths.admin);
});

// setup("authenticate super-admin", async ({ page }) => {
//   setup.skip(
//     !demoUsers.superAdmin.email,
//     "Set E2E_SUPER_ADMIN_EMAIL to save super-admin auth state",
//   );
//   await performLogin(page, demoUsers.superAdmin);
//   await saveAuthState(page, authPaths.superAdmin);
// });
