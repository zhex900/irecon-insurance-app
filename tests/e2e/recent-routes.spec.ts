// import { expect, test } from "@playwright/test";

// import {
//   clickRecentRoute,
//   fetchRecentRoutesFromApi,
//   getRecentRoutesInSidebar,
//   leaveFor,
//   prepareRecentsShell,
// } from "./helpers/recent-routes";

// test.describe("recent routes", () => {
//   test.beforeEach(async ({ page }) => {
//     await prepareRecentsShell(page);
//   });

//   test("records the page being left and hides the current page", async ({
//     page,
//   }) => {
//     await page.goto("/clients");
//     await expect(
//       page.getByRole("heading", { name: /clients/i }).first(),
//     ).toBeVisible();

//     await leaveFor(page, "/policies");
//     await expect(
//       page.getByRole("heading", { name: /policies/i }).first(),
//     ).toBeVisible();

//     const recents = await getRecentRoutesInSidebar(page);
//     expect(recents.map((route) => route.label)).toContain("Clients");
//     expect(recents.map((route) => route.label)).not.toContain("Policies");
//   });

//   test("preserves visit order with the most recent first", async ({ page }) => {
//     await page.goto("/clients");
//     await leaveFor(page, "/policies");
//     await leaveFor(page, "/reports");

//     const recents = await getRecentRoutesInSidebar(page);
//     expect(recents.map((route) => route.label)).toEqual([
//       "Policies",
//       "Clients",
//     ]);
//   });

//   test("clicking a recent route navigates there", async ({ page }) => {
//     await page.goto("/clients");
//     await leaveFor(page, "/policies");
//     await leaveFor(page, "/reports");

//     await clickRecentRoute(page, /^clients$/i);
//     await expect(page).toHaveURL(/\/clients/);
//     await expect(
//       page.getByRole("heading", { name: /clients/i }).first(),
//     ).toBeVisible();
//   });

//   test("persists across reload", async ({ page }) => {
//     await page.goto("/clients");
//     await leaveFor(page, "/policies");
//     await leaveFor(page, "/reports");

//     await page.reload();
//     await expect(
//       page.getByRole("heading", { name: /reports/i }).first(),
//     ).toBeVisible();

//     const recents = await fetchRecentRoutesFromApi(page);
//     expect(recents.map((route) => route.href)).toEqual([
//       "/policies",
//       "/clients",
//     ]);
//   });

//   test("removes a deleted client from recents", async ({ page }) => {
//     const stamp = Date.now();
//     const registeredName = `E2E Recent Client ${stamp}`;

//     await page.goto("/clients");
//     await page.getByRole("button", { name: /new client/i }).click();
//     await expect(page).toHaveURL(/\/clients\/[^/]+\/edit/);

//     await page
//       .getByRole("textbox", { name: "Registered Name" })
//       .fill(registeredName);
//     await page
//       .getByRole("textbox", { name: "Trading Name" })
//       .fill(registeredName);
//     await page.getByRole("textbox", { name: "ABN" }).fill("12345678901");
//     await page.getByRole("textbox", { name: "Phone" }).fill("0412 345 678");
//     await page.getByRole("textbox", { name: "Email" }).fill("test@test.com");

//     const accountManager = page.getByLabel(/account manager/i);
//     if (await accountManager.count()) {
//       await accountManager.click();
//       const option = page.getByRole("option").first();
//       if (await option.count()) await option.click();
//     }

//     const ar = page.getByLabel(/authorised representative/i);
//     if (await ar.count()) {
//       await ar.click();
//       const option = page.getByRole("option").first();
//       if (await option.count()) await option.click();
//     }

//     await page.getByRole("button", { name: /^save$/i }).click();
//     await expect(page).toHaveURL(/\/clients\/[^/]+$/);

//     const clientUrl = page.url();
//     const clientId = clientUrl.match(/\/clients\/([^/?]+)/)?.[1];
//     expect(clientId).toBeTruthy();

//     await leaveFor(page, "/policies");

//     let routes = await fetchRecentRoutesFromApi(page);
//     expect(routes.some((route) => route.href === `/clients/${clientId}`)).toBe(
//       true,
//     );

//     await page.goto(`/clients?q=${encodeURIComponent(registeredName)}`);
//     await expect(page.getByText(registeredName).first()).toBeVisible({
//       timeout: 15_000,
//     });

//     await page
//       .getByRole("button", { name: `Delete ${registeredName}` })
//       .click();
//     await page
//       .getByRole("dialog", { name: /delete client/i })
//       .getByRole("button", { name: /^delete$/i })
//       .click();

//     await expect(page.getByText(/deleted/i).first()).toBeVisible({
//       timeout: 15_000,
//     });

//     routes = await fetchRecentRoutesFromApi(page);
//     expect(
//       routes.some((route) => route.href.startsWith(`/clients/${clientId}`)),
//     ).toBe(false);
//   });

//   test("removes a deleted policy from recents", async ({ page }) => {
//     const stamp = Date.now();
//     const registeredName = `E2E Recent Policy Client ${stamp}`;

//     await page.goto("/clients");
//     await page.getByRole("button", { name: /new client/i }).click();
//     await page
//       .getByRole("textbox", { name: "Registered Name" })
//       .fill(registeredName);
//     await page
//       .getByRole("textbox", { name: "Trading Name" })
//       .fill(registeredName);
//     await page.getByRole("textbox", { name: "ABN" }).fill("12345678901");
//     await page.getByRole("textbox", { name: "Phone" }).fill("0412 345 678");
//     await page.getByRole("textbox", { name: "Email" }).fill("test@test.com");

//     const accountManager = page.getByLabel(/account manager/i);
//     if (await accountManager.count()) {
//       await accountManager.click();
//       const option = page.getByRole("option").first();
//       if (await option.count()) await option.click();
//     }

//     const ar = page.getByLabel(/authorised representative/i);
//     if (await ar.count()) {
//       await ar.click();
//       const option = page.getByRole("option").first();
//       if (await option.count()) await option.click();
//     }

//     await page.getByRole("button", { name: /^save$/i }).click();
//     await expect(page).toHaveURL(/\/clients\/[^/]+$/);

//     const newPolicyPromise = page.waitForResponse(
//       (response) =>
//         response.url().includes("policies/new.data?clientId=") &&
//         response.request().method() === "POST",
//     );
//     await page
//       .getByRole("button", { name: /new policy/i })
//       .first()
//       .click();
//     await newPolicyPromise;
//     await expect(page).toHaveURL(/\/policies\/[^/?]+$/);

//     const policyId = page.url().match(/\/policies\/([^/?]+)/)?.[1];
//     expect(policyId).toBeTruthy();

//     await leaveFor(page, "/clients");

//     let routes = await fetchRecentRoutesFromApi(page);
//     expect(routes.some((route) => route.href === `/policies/${policyId}`)).toBe(
//       true,
//     );

//     await page.goto(`/policies/${policyId}`);
//     await page.getByRole("button", { name: /^delete$/i }).click();
//     await page
//       .getByRole("dialog", { name: /delete policy/i })
//       .getByRole("button", { name: /^delete$/i })
//       .click();

//     await expect(page).toHaveURL(/\/clients\//, { timeout: 15_000 });

//     routes = await fetchRecentRoutesFromApi(page);
//     expect(
//       routes.some((route) => route.href.startsWith(`/policies/${policyId}`)),
//     ).toBe(false);
//   });
// });
