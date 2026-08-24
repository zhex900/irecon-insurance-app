import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";

import { mockResendEmailApi } from "./helpers/auth";
import {
  fillRequiredPolicyForm,
  openFirstClientAndStartPolicy,
  submitPolicy,
} from "./helpers/policy-wizard";

test.describe("quote-to-taken workflow", () => {
  test.beforeEach(async ({ page }) => {
    await mockResendEmailApi(page);
  });

  test("complete quote-to-taken journey with document generation", async ({
    page,
  }) => {
    await openFirstClientAndStartPolicy(page);

    const { newPolicyResponsePromises, policyId } =
      await fillRequiredPolicyForm(page, {
        insuredName: faker.company.name(),
        siteAddress: `${faker.location.streetAddress()}, ${faker.location.city()}`,
        turnover: 1_000_000,
        contractWorks: 1_500_000,
        displayHomes: 10,
        existingStructures: 30,
        plantEquipment: 40,
      });

    await submitPolicy(page, { newPolicyResponsePromises, policyId });

    const wizardRoot = page.locator("[data-policy-phase]");
    await expect(wizardRoot).toHaveAttribute("data-policy-phase", "pending", {
      timeout: 90_000,
    });

    await page.getByRole("button", { name: /^Policy status$/i }).click();
    await page
      .getByRole("menuitem", { name: "Not taken", exact: true })
      .click();

    await expect(
      page.getByRole("dialog", { name: /Mark policy as Not taken/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Confirm$/i }).click();

    await expect(
      page.locator('[data-slot="badge"]', { hasText: /^Not taken$/ }),
    ).toHaveCount(2);
  });
});
