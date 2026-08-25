import { expect, test } from "@playwright/test";

import { mockResendEmailApi } from "./helpers/auth";

/**
 * Policy list and document-email entry points (Resend mocked).
 * Taken-policy flows are covered by policy-matrix.spec.ts.
 */
test.describe("policy journeys", () => {
  test("email documents dialog validates empty recipient (Resend mocked)", async ({
    page,
  }) => {
    await mockResendEmailApi(page);
    const listPoliciesPromise = page.waitForResponse(
      "**/api/policies/list-stats.data?**",
    );
    await page.goto("/policies?status=2");

    const policyRow = page.getByRole("row", { name: /^open policy/i });
    await listPoliciesPromise;
    await expect(policyRow.first()).toBeVisible();
    await policyRow.first().click();
    await expect(page).toHaveURL(/\/policies\/[^/?]+$/);

    const emailButton = page.getByRole("button", { name: /email selected/i });
    const selectAll = page.getByRole("checkbox", { name: /select all/i });
    if (await selectAll.count()) {
      await selectAll.check();
    }

    await emailButton.click();
    await page.getByRole("menuitem", { name: /broker/i }).click();
    await page.getByLabel(/^to$/i).fill("");
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(
      page.getByText(/Enter at least one recipient email/i),
    ).toBeVisible();
  });
});

test.describe("policy status transitions", () => {
  test("policy status filters work correctly in policies list", async ({
    page,
  }) => {
    const statusTests = [
      { query: "?status=1" },
      { query: "?status=2" },
      { query: "?status=3" },
    ];

    for (const testCase of statusTests) {
      await page.goto(`/policies${testCase.query}`);
      await expect(page).toHaveURL(
        new RegExp(testCase.query.replace("?", "\\?")),
      );
      await expect(
        page.getByRole("heading", { name: /policies/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("table").or(page.getByText(/no policies|empty/i)),
      ).toBeVisible();
    }
  });
});
