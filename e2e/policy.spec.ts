import { expect, test } from "@playwright/test";
import { demoUsers, loginAs, mockResendEmailApi } from "./helpers/auth";

/**
 * Full Taken + docs + email is environment-heavy.
 * This suite covers the reachable entry points and email dialog validation
 * with Resend mocked when a policy with documents is available.
 */
test.describe("policy journeys", () => {
  test("open policies list and start from an existing client when present", async ({
    page,
  }) => {
    await loginAs(page, demoUsers.broker);
    await page.goto("/policies");
    await expect(
      page.getByRole("heading", { name: /policies/i }).first(),
    ).toBeVisible();

    await page.goto("/clients");
    const firstClientLink = page
      .getByRole("link")
      .filter({ hasText: /.+/ })
      .nth(1);
    // If the list is empty, skip the deep path.
    const clientHref = await firstClientLink
      .getAttribute("href")
      .catch(() => null);
    test.skip(
      !clientHref?.includes("/clients/"),
      "No clients seeded for policy e2e",
    );

    await page.goto(clientHref!);
    const newPolicy = page.getByRole("button", {
      name: /new policy|add policy/i,
    });
    if (await newPolicy.count()) {
      await newPolicy.first().click();
      await expect(page).toHaveURL(/\/policies\/\d+/);
    }
  });

  test("email documents dialog validates empty recipient (Resend mocked)", async ({
    page,
  }) => {
    await mockResendEmailApi(page);
    await loginAs(page, demoUsers.broker);
    await page.goto("/policies");

    const policyLink = page.locator('a[href^="/policies/"]').first();
    test.skip(
      (await policyLink.count()) === 0,
      "No policies available for email dialog e2e",
    );

    await policyLink.click();
    await expect(page).toHaveURL(/\/policies\/\d+/);

    const emailButton = page.getByRole("button", { name: /email selected/i });
    if ((await emailButton.count()) === 0) {
      test.skip(true, "Premium summary email UI not visible (no documents)");
    }

    // Need at least one selected doc; try select-all checkbox if present.
    const selectAll = page.getByRole("checkbox", { name: /select all/i });
    if (await selectAll.count()) {
      await selectAll.check();
    }

    if (await emailButton.isDisabled()) {
      test.skip(true, "Email selected disabled — no documents selected");
    }

    await emailButton.click();
    await page.getByRole("menuitem", { name: /broker/i }).click();
    await page.getByLabel(/^to$/i).fill("");
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(/recipient email/i)).toBeVisible();
  });

  test("adjustment entry exists on Taken policies when present", async ({
    page,
  }) => {
    await loginAs(page, demoUsers.broker);
    await page.goto("/policies");
    const adjustLink = page.getByRole("link", { name: /adjust/i }).first();
    if ((await adjustLink.count()) === 0) {
      // Try opening first policy and look for Adjust action.
      const policyLink = page.locator('a[href^="/policies/"]').first();
      test.skip(
        (await policyLink.count()) === 0,
        "No policies for adjustment e2e",
      );
      await policyLink.click();
      const adjust = page.getByRole("link", { name: /adjust/i });
      test.skip(
        (await adjust.count()) === 0,
        "No Taken policy with Adjust action",
      );
      await adjust.first().click();
    } else {
      await adjustLink.click();
    }
    await expect(page).toHaveURL(/\/policies\/\d+\/adjust/);
  });
});
