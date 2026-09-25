import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";

import {
  openFirstClientAndStartPolicy,
  policyIdFromUrl,
} from "./helpers/policy-wizard";
import type { RecentNavStep } from "./helpers/recent-routes";
import {
  clearRecentRoutes,
  clickRecentRoute,
  fetchRecentRoutesFromApi,
  getClientDirectoryLabel,
  getRecentRouteLabels,
  navigateRecentRoutes,
  prepareRecentsShell,
} from "./helpers/recent-routes";

test.describe("recent routes", () => {
  test.describe.configure({
    mode: "serial",
    // Preview Workers + Hyperdrive: policy wizard + delete can exceed the default 60s.
    timeout: process.env.CI ? 180_000 : 60_000,
  });

  test.beforeEach(async ({ page }) => {
    await prepareRecentsShell(page);
    await clearRecentRoutes(page);
  });

  test("records the page being left and hides the current page", async ({
    page,
  }) => {
    const navigation: RecentNavStep[] = [
      {
        action: "goto",
        path: "/clients",
        heading: /clients directory/i,
        waitForReferenceList: true,
      },
      { action: "clientRow", index: 0 },
      { action: "link", name: "Clients", url: /\/clients(?:\?|$)/ },
      { action: "clientRow", index: 1 },
      { action: "sidebar", path: "/policies" },
    ];

    await navigateRecentRoutes(page, [navigation[0]!]);
    const firstClient = await getClientDirectoryLabel(page, 0);
    const secondClient = await getClientDirectoryLabel(page, 1);
    await navigateRecentRoutes(page, navigation.slice(1));

    const expectedRecents = [secondClient, "Clients", firstClient];

    await expect
      .poll(() => getRecentRouteLabels(page))
      .toEqual(expectedRecents);

    await page.reload();
    await expect
      .poll(() => getRecentRouteLabels(page))
      .toEqual(expectedRecents);
  });

  test("removes a deleted client from recents", async ({ page }) => {
    const registeredName = faker.company.name();

    await page.goto("/clients");
    await page.getByRole("button", { name: /new client/i }).click();
    await expect(page).toHaveURL(/\/clients\/[^/]+\/edit/);

    await page
      .getByRole("textbox", { name: "Registered Name" })
      .fill(registeredName);
    await page
      .getByRole("textbox", { name: "Trading Name" })
      .fill(registeredName);
    await page.getByRole("textbox", { name: "ABN" }).fill("12345678901");
    await page.getByRole("textbox", { name: "Phone" }).fill("0412 345 678");
    await page.getByRole("textbox", { name: "Email" }).fill("test@test.com");

    for (const label of [/account manager/i, /authorised representative/i]) {
      const field = page.getByLabel(label);
      if ((await field.count()) === 0) continue;
      await field.click();
      const option = page.getByRole("option").first();
      if ((await option.count()) === 0) continue;
      await option.getByRole("button").click();
    }

    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/clients\/[^/]+$/, { timeout: 15_000 });

    const clientId = page.url().match(/\/clients\/([^/?]+)/)?.[1];
    expect(clientId).toBeTruthy();

    await expect
      .poll(
        async () => {
          const routes = await fetchRecentRoutesFromApi(page);
          return routes.some(
            (route) => route.href === `/clients/${clientId}/edit`,
          );
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    await page.getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("dialog", { name: /delete client/i })
      .getByRole("button", { name: /^delete$/i })
      .click();

    await expect(page).toHaveURL(/\/clients(?:\?|$)/, { timeout: 15_000 });

    await expect
      .poll(async () => {
        const routes = await fetchRecentRoutesFromApi(page);
        return routes.some((route) =>
          route.href.startsWith(`/clients/${clientId}`),
        );
      })
      .toBe(false);

    await expect
      .poll(() => getRecentRouteLabels(page), { timeout: 15_000 })
      .toEqual([]);
  });

  test("removes a deleted policy from recents", async ({ page }) => {
    await openFirstClientAndStartPolicy(page);
    await page
      .getByRole("textbox", { name: "Insured Name" })
      .fill(faker.company.name());

    const policyId = policyIdFromUrl(page);
    const saveDraftPromise = page.waitForResponse(
      (response) =>
        response.url().includes(`api/policies/${policyId}/draft`) &&
        response.request().method() === "PUT",
    );

    await page.keyboard.press("Control+s");

    const policyNumber = (
      await page.getByRole("heading", { name: "Policy number" }).textContent()
    )?.trim();
    expect(policyNumber).toBeTruthy();
    await saveDraftPromise;
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    const recentsCarriedOver = (await getRecentRouteLabels(page)).filter(
      (label) => label !== "Clients",
    );

    await navigateRecentRoutes(page, [
      { action: "link", name: "Clients", url: /\/clients(?:\?|$)/ },
    ]);
    await expect(
      page.getByRole("heading", { name: /clients directory/i }),
    ).toBeVisible();

    expect((await fetchRecentRoutesFromApi(page))[0]?.label).toBe(policyNumber);
    await expect
      .poll(() => getRecentRouteLabels(page))
      .toEqual([policyNumber!, ...recentsCarriedOver]);

    await clickRecentRoute(page, policyNumber!, {
      url: new RegExp(`/policies/${policyId}(?:[/?#]|$)`),
    });

    await page.getByRole("button", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog", { name: /delete policy/i })
      .getByRole("button", { name: /^delete$/i })
      .click();

    await expect(page).toHaveURL(/\/clients\//, { timeout: 15_000 });

    await expect
      .poll(async () => {
        const routes = await fetchRecentRoutesFromApi(page);
        return routes.some((route) =>
          route.href.startsWith(`/policies/${policyId}`),
        );
      })
      .toBe(false);

    await expect
      .poll(() => getRecentRouteLabels(page), { timeout: 20_000 })
      .toEqual(["Clients"]);
  });
});
