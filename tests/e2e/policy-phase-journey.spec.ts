import { expect, test } from "@playwright/test";

import { mockResendEmailApi } from "./helpers/auth";
import {
  fillRequiredPolicyForm,
  markPolicyTaken,
  openFirstClientAndStartPolicy,
  submitPolicy,
  waitForPremiumCalculation,
  wizardRoot,
} from "./helpers/policy-wizard";

test.describe("policy phase journey", () => {
  test.beforeEach(async ({ page }) => {
    await mockResendEmailApi(page);
  });

  test.skip("new policy progresses through new → pending → taken", async ({
    page,
  }) => {
    const insuredName = `E2E Phase ${Date.now()}`;

    await openFirstClientAndStartPolicy(page);

    await expect(page.getByText(/^Draft$/i)).toBeVisible();
    await expect(page.getByText(/^Editing$/i)).toHaveCount(0);
    await expect(page.getByText(/^View only$/i)).toHaveCount(0);
    await expect(page.getByText(/^Pending$/i).first()).toBeVisible();

    await fillRequiredPolicyForm(page, { insuredName });
    await waitForPremiumCalculation(page);

    await submitPolicy(page);

    await expect(page.getByText(/^Draft$/i)).toHaveCount(0);
    await expect(page.getByText(/^Pending$/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^submit$/i }).first(),
    ).toBeVisible();

    await markPolicyTaken(page);

    await expect(wizardRoot(page)).toHaveAttribute(
      "data-policy-phase",
      "taken",
    );
    await expect(page.getByText(/^Taken$/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^submit$/i })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: /back to client/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Policy status$/i }),
    ).toHaveCount(0);
  });
});
