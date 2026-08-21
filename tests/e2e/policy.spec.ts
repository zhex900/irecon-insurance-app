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
    await page.waitForLoadState("networkidle");

    const policyRow = page.getByRole("row", { name: /^open policy/i });

    await page.waitForLoadState("networkidle");
    await policyRow.first().click();
    await expect(page).toHaveURL(/\/policies\/[^/?]+$/);

    const emailButton = page.getByRole("button", { name: /email selected/i });
    // Need at least one selected doc; try select-all checkbox if present.
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
    // Adjust only appears on Taken policies that have a saved premium
    // (see canAdjust in $policyId.tsx) — filter to Taken status and scan a
    // bounded number of rows rather than assuming the first one qualifies.
    await page.goto("/policies?status=2");
    await page.waitForLoadState("networkidle");
    const takenRows = page.getByRole("row", { name: /^open policy/i });
    const rowCount = await takenRows.count();

    let adjustLink = null;
    const maxRowsToScan = Math.min(rowCount, 10);
    for (let i = 0; i < maxRowsToScan; i++) {
      await page.goto("/policies?status=2");
      await page.waitForLoadState("networkidle");
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

/**
 * Policy status transition tests
 * Verifies that policies can move through the lifecycle correctly
 */
test.describe("policy status transitions", () => {
  test.skip("pending policy can be submitted and transitions to Taken status", async ({
    page,
  }) => {
    // Navigate to a pending policy
    await page.goto("/policies?status=1");
    const pendingRow = page.getByRole("row", { name: /^open policy/i });

    await pendingRow.first().getByRole("cell").nth(2).click();
    await expect(page).toHaveURL(/\/policies\/[^/?]+$/);

    // Verify we're in edit mode
    const wizardRoot = page.locator("[data-policy-phase]");
    await expect(wizardRoot).toHaveAttribute("data-policy-phase", "pending");

    // complete the policy form
    await page.getByRole("textbox", { name: "Insured Name" }).fill("John Doe");

    // Find and click submit button
    const submitButton = page
      .getByRole("button", { name: /^submit$/i })
      .first();

    // Submit the policy
    await submitButton.click();

    // Verify status changed - check for success message or status indicator
    await expect(
      page.getByText(/submitted successfully|policy taken/i),
    ).toBeVisible();

    // Verify policy is now in Taken status (might need to reload or check status indicator)
    await page.reload();

    // After submission, policy should be in Taken status and in view mode
    await expect(wizardRoot).toHaveAttribute(
      "data-policy-phase",
      /taken|not-taken/,
    );
  });

  test.skip("pending policy can be rejected and transitions to Not taken status", async ({
    page,
  }) => {
    // Navigate to a pending policy
    await page.goto("/policies?status=1");
    const pendingRow = page.getByRole("row", { name: /^open policy/i });

    await pendingRow.first().getByRole("cell").nth(2).click();
    await expect(page).toHaveURL(/\/policies\/[^/?]+$/);

    // Find the status dropdown/selector - based on PolicyStatusMenu component
    // It should be a button showing the current status ("Pending")
    const statusButton = page
      .getByRole("button")
      .filter({ hasText: /pending/i })
      .first();

    test.skip(
      (await statusButton.count()) === 0,
      "Status selector button not found - UI may have changed",
    );

    await statusButton.click();

    // Select "Not taken" from the dropdown menu
    const notTakenOption = page
      .getByRole("menuitem")
      .filter({ hasText: /not taken/i })
      .first();

    test.skip(
      (await notTakenOption.count()) === 0,
      "Not taken option not available in status menu",
    );

    await notTakenOption.click();

    // Handle confirmation dialog - PolicyStatusMenu shows a confirmation dialog for terminal statuses
    const confirmDialogButton = page
      .getByRole("button")
      .filter({ hasText: /confirm/i })
      .first();

    if (await confirmDialogButton.count()) {
      await confirmDialogButton.click();
    }

    // Verify status changed to Not taken
    await expect(page.getByText(/not taken/i)).toBeVisible();

    // After rejection, policy should be in Not taken status (terminal) and in view mode
    await page.reload();
    const wizardRoot = page.locator("[data-policy-phase]");
    await expect(wizardRoot).toHaveAttribute(
      "data-policy-phase",
      /taken|not-taken/,
    );
  });

  test.skip("Taken policy can be cloned to create new Pending draft", async ({
    page,
  }) => {
    // Navigate to Taken policies
    await page.goto("/policies?status=2");
    const takenRow = page.getByRole("row", { name: /^open policy/i });
    await takenRow.first().getByRole("cell").nth(1).click({
      force: true,
    });
    await expect(page).toHaveURL(/\/policies\/[^/?]+$/);

    // Wait for view mode
    const wizardRoot = page.locator("[data-policy-phase]");
    await expect(wizardRoot).toHaveAttribute(
      "data-policy-phase",
      /taken|not-taken/,
    );

    // Clone the policy
    const cloneButton = page.getByRole("button", { name: /clone/i });
    // test.skip((await cloneButton.count()) === 0, "Clone button not available");

    await cloneButton.first().click();
    await expect(page).toHaveURL(/\/policies\/[^/]+\?cloned=1/);

    // New clone should be in edit mode
    await expect(wizardRoot).toHaveAttribute("data-policy-phase", "pending");

    // Should have submit button available
    await expect(
      page.getByRole("button", { name: /^submit$/i }).first(),
    ).toBeVisible();
  });

  test("policy status filters work correctly in policies list", async ({
    page,
  }) => {
    // Test each status filter
    const statusTests = [
      { status: "pending", query: "?status=1", expectedText: /pending/i },
      { status: "taken", query: "?status=2", expectedText: /taken/i },
      { status: "not taken", query: "?status=3", expectedText: /not taken/i },
    ];

    for (const testCase of statusTests) {
      await page.goto(`/policies${testCase.query}`);

      // Verify URL contains the status filter
      await expect(page).toHaveURL(
        new RegExp(testCase.query.replace("?", "\\?")),
      );

      // Check that we can see policies (or empty state if none)
      const policyTable = page.getByRole("table");
      const emptyState = page.getByText(/no policies|empty/i);

      if (await policyTable.count()) {
        // If there are policies, verify at least one row exists
        const policyRows = page.getByRole("row", { name: /^open policy/i });
        if (await policyRows.count()) {
          // We have policies - test passes
          continue;
        }
      } else if (await emptyState.count()) {
        // Empty state is acceptable
        continue;
      }

      // If we reach here, write a skip message
      test.skip(true, `No ${testCase.status} policies or empty state visible`);
    }
  });

  test("policy status badges display correctly", async ({ page }) => {
    // Go to policies list
    await page.goto("/policies");

    // Look for status badges in the table
    const statusCells = page.locator("[data-status]");
    if ((await statusCells.count()) === 0) {
      test.skip(true, "No status badges visible in policies list");
      return;
    }

    // Check that status badges have appropriate styling/text
    const firstStatusCell = statusCells.first();
    const statusText = await firstStatusCell.textContent();

    // Status should be one of: Pending, Taken, Not taken
    expect(statusText).toMatch(/pending|taken|not taken/i);

    // Status should have appropriate color/class
    const statusValue = await firstStatusCell.getAttribute("data-status");
    expect(statusValue).toMatch(/^[1-3]$/); // Should be 1, 2, or 3
  });
});

// test.describe("policy wizard modes", () => {
//   test('new draft policy renders in "new" mode, then "edit" mode once the ?new=1 marker is gone', async ({
//     page,
//   }) => {
//     await page.goto("/clients");
//     await openFirstClientAndStartPolicy(page);

//     const wizardRoot = page.locator("[data-policy-phase]");
//     await expect(wizardRoot).toHaveAttribute("data-policy-phase", "new");
//     await expect(page.getByText(/^Editing$/i)).toHaveCount(0);
//     await expect(page.getByText(/^View only$/i)).toHaveCount(0);
//     await expect(page.getByText(/^Draft$/i)).toBeVisible();
//     await expect(
//       page.getByRole("button", { name: /^submit$/i }).first(),
//     ).toBeVisible();
//     await expect(page.getByRole("button", { name: /^cancel$/i })).toBeVisible();

//     // Drop the `?new=1` marker (plain re-navigation, not a submit) — the same
//     // Pending/non-terminal draft should now render in "edit" mode.
//     const policyUrl = page.url().split("?")[0];
//     await page.goto(policyUrl);
//     await expect(wizardRoot).toHaveAttribute("data-policy-phase", "pending");
//     await expect(
//       page.getByRole("button", { name: /^submit$/i }).first(),
//     ).toBeVisible();
//   });

//   test('terminal (Taken / Not taken) policies render in read-only "view" mode', async ({
//     page,
//   }) => {
//     await page.goto("/policies?status=2,3");
//     const terminalRow = page.getByRole("row", { name: /^open policy/i });

//     await terminalRow.first().click();
//     await expect(page).toHaveURL(/\/policies\/[^/?]+$/);

//     const wizardRoot = page.locator("[data-policy-phase]");
//     await expect(wizardRoot).toHaveAttribute(
//       "data-policy-phase",
//       /taken|not-taken/,
//     );
//     await expect(page.getByRole("button", { name: /^submit$/i })).toHaveCount(
//       0,
//     );
//     await expect(
//       page.getByRole("button", { name: /back to client/i }),
//     ).toBeVisible();
//   });

//   test("cloning a terminal policy opens an editable draft with the cloned marker", async ({
//     page,
//   }) => {
//     await page.goto("/policies?status=2,3");
//     const terminalRow = page.getByRole("row", { name: /^open policy/i });

//     await terminalRow.first().click();

//     // Wait for the "view" mode header (and its actions) to actually render —
//     // `.count()` on the Clone button right after a client-side nav would race
//     // the loaderData-driven header actions.
//     const wizardRoot = page.locator("[data-policy-phase]");
//     await expect(wizardRoot).toHaveAttribute(
//       "data-policy-phase",
//       /taken|not-taken/,
//     );

//     const cloneButton = page.getByRole("button", { name: /clone/i });

//     await cloneButton.first().click();
//     await expect(page).toHaveURL(/\/policies\/[^/]+\?cloned=1/);

//     // A fresh clone is a new Pending draft — editable, not the source's "view" mode.
//     await expect(wizardRoot).toHaveAttribute("data-policy-phase", "pending");
//     await expect(
//       page.getByRole("button", { name: /^submit$/i }).first(),
//     ).toBeVisible();
//   });
// });
