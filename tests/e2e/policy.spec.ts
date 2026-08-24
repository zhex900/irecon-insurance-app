import { expect, test } from "@playwright/test";

import { mockResendEmailApi } from "./helpers/auth";
import { openFirstClientAndStartPolicy } from "./helpers/policy-wizard";

/**
 * Full Taken + docs + email is environment-heavy.
 * This suite covers the reachable entry points and email dialog validation
 * with Resend mocked when a policy with documents is available.
 */
test.describe("policy journeys", () => {
  test("open policies list and start from an existing client when present", async ({
    page,
  }) => {
    await page.goto("/policies");
    await expect(
      page.getByRole("heading", { name: /policies/i }).first(),
    ).toBeVisible();
    await openFirstClientAndStartPolicy(page);

    const newPolicy = page.getByRole("button", {
      name: /new policy|add policy/i,
    });
    if (await newPolicy.count()) {
      await newPolicy.first().click();
      await expect(page).toHaveURL(/\/policies\/[^/?]+/);
    }
  });

  test("email documents dialog validates empty recipient (Resend mocked)", async ({
    page,
  }) => {
    await mockResendEmailApi(page);
    await page.goto("/policies?status=2");

    const policyRow = page.getByRole("row", { name: /^open policy/i });
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

  test("adjustment entry exists on Taken policies when present", async ({
    page,
  }) => {
    await page.goto("/policies?status=2");
    const takenRows = page.getByRole("row", { name: /^open policy/i });
    const rowCount = await takenRows.count();

    let adjustLink = null;
    const maxRowsToScan = Math.min(rowCount, 10);
    for (let i = 0; i < maxRowsToScan; i++) {
      await page.goto("/policies?status=2");
      await takenRows.nth(i).click();
      await expect(page).toHaveURL(/\/policies\/[^/?]+$/);
      const candidate = page.getByRole("link", { name: /adjust/i });
      if (await candidate.count()) {
        adjustLink = candidate.first();
        break;
      }
    }
    test.skip(
      !adjustLink,
      "No Taken policy with a saved premium (Adjust action) found",
    );

    await adjustLink!.click();
    await expect(page).toHaveURL(/\/policies\/[^/]+\/adjust/);
  });
});

test.describe("policy status transitions", () => {
  test("policy status filters work correctly in policies list", async ({
    page,
  }) => {
    const statusTests = [
      { status: "pending", query: "?status=1" },
      { status: "taken", query: "?status=2" },
      { status: "not taken", query: "?status=3" },
    ];

    for (const testCase of statusTests) {
      await page.goto(`/policies${testCase.query}`);
      await expect(page).toHaveURL(
        new RegExp(testCase.query.replace("?", "\\?")),
      );

      const policyTable = page.getByRole("table");
      const emptyState = page.getByText(/no policies|empty/i);

      if (await policyTable.count()) {
        const policyRows = page.getByRole("row", { name: /^open policy/i });
        if (await policyRows.count()) continue;
      } else if (await emptyState.count()) {
        continue;
      }

      test.skip(true, `No ${testCase.status} policies or empty state visible`);
    }
  });

  test("policy status badges display correctly", async ({ page }) => {
    await page.goto("/policies");

    const statusCells = page.locator("[data-status]");
    if ((await statusCells.count()) === 0) {
      test.skip(true, "No status badges visible in policies list");
      return;
    }

    const firstStatusCell = statusCells.first();
    const statusText = await firstStatusCell.textContent();
    expect(statusText).toMatch(/pending|taken|not taken/i);

    const statusValue = await firstStatusCell.getAttribute("data-status");
    expect(statusValue).toMatch(/^[1-3]$/);
  });
});
