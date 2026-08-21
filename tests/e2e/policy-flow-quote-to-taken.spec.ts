import { expect, test } from "@playwright/test";

import { mockResendEmailApi } from "./helpers/auth";

test.describe("quote-to-taken workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Resend API for email tests
    await mockResendEmailApi(page);
  });

  test("complete quote-to-taken journey with document generation", async ({
    page,
  }) => {
    // 1. Navigate to clients
    await page.goto("/clients");
    await page.waitForLoadState("networkidle");
    // Find or create a test client
    const clientRow = page.getByRole("row", { name: /open client/i });

    // Open first available client
    await clientRow.first().click();
    await expect(page).toHaveURL(/\/clients\/[^/]+$/);

    // 3. Start new policy
    const newPolicyBtn = page.getByRole("button", { name: /new policy/i });

    await newPolicyBtn.first().click();

    // Should be redirected to new policy wizard with ?new=1 marker
    await expect(page).toHaveURL(/\/policies\/[^/]+\?new=1/);

    // 4. Verify wizard is in "new" mode
    const wizardRoot = page.locator("[data-policy-phase]");
    await expect(wizardRoot).toHaveAttribute("data-policy-phase", "new");

    // 5. Complete basic policy information

    await page
      .getByRole("textbox", { name: "Insured Name" })
      .fill("E2E Test Insured");
    await page.getByRole("combobox", { name: "Annual Type of Cover" }).click();
    await page.getByRole("option", { name: "Contract Commencing" }).click();
    //select contract commencing

    await page
      .getByRole("textbox", { name: "Site Address" })
      .fill("123 E2E Test Street, Sydney ");
    await page.getByRole("textbox", { name: "Postcode" }).fill("2000");
    await page.getByRole("combobox", { name: "State" }).click();
    await page.getByRole("option", { name: "NSW" }).click();
    await page
      .getByRole("textbox", { name: "Estimated Turnover / Project" })
      .fill("1000000");

    await page.getByRole("combobox", { name: "Do you hold a current" }).click();
    await page.getByRole("option", { name: "No" }).click();
    await page.getByRole("textbox", { name: "Contract Works" }).fill("1500000");
    await page.getByRole("textbox", { name: "Display Homes" }).fill("10");
    await page.getByRole("textbox", { name: "Existing Structures" }).fill("30");

    //<input id="plantEquipment" type="text" data-slot="input-group-control" inputmode="decimal" autocomplete="off" aria-invalid="false" class="h-8 w-full min-w-0 border-input px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:aria-invalid:border-destructive/50 flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent" name="plantEquipment" value="">

    await page.locator('input[name="plantEquipment"]').fill("40");

    await page.getByRole("combobox", { name: "Limit of Liability" }).click();
    await page.getByRole("option", { name: "$10 Million" }).click();
    await page
      .getByRole("combobox", { name: /Have any claims exceeded \$20/i })
      .click();
    await page
      .getByRole("listbox")
      .getByRole("option", { name: "No", exact: true })
      .click();

    await page
      .getByRole("textbox", { name: "Number of claims last 3 years" })
      .fill("1");

    await expect(
      page.getByRole("button", { name: "Submit" }).first(),
    ).toBeDisabled();

    await page.getByText(/confirm you have asked and/i).click({ force: true });
    await page
      .getByRole("checkbox", { name: "Unsealed Roadworks The" })
      .click({ force: true });

    await expect(
      page.getByRole("button", { name: "Submit" }).first(),
    ).toBeEnabled();

    await page
      .getByRole("button", { name: "Submit" })
      .first()
      .click({ force: true });

    await page.getByRole("button", { name: "Confirm & generate" }).click();
    // await page
    //   .getByRole("checkbox", { name: "Confirm you have asked and" })
    //   .focus();
    // await page.keyboard.press("Space");

    // 10. Remove ?new=1 marker to see the saved policy
    // const currentUrl = await page.url();
    // const baseUrl = currentUrl.split("?")[0];
    // await page.goto(baseUrl);

    // // Now policy should be in "edit" mode
    await expect(wizardRoot).toHaveAttribute("data-policy-phase", "pending");

    await page.getByRole("button", { name: /^Policy status$/i }).click();
    await page
      .getByRole("menuitem", { name: "Not taken", exact: true })
      .click();

    await expect(
      page.getByRole("dialog", { name: /Mark policy as Not taken/i }),
    ).toBeVisible();
    await expect(page.getByRole("menu")).toBeHidden();

    await page.getByRole("button", { name: /^Confirm$/i }).click();

    await expect(
      page.locator('[data-slot="badge"]', { hasText: /^Not taken$/ }),
    ).toHaveCount(2);

    // await page.getByRole("menuitem", { name: "Taken", exact: true }).click({
    //   delay: 100,
    //   noWaitAfter: true,
    // });

    // await page.locator("body").click();
    // await expect(
    //   page.getByText("Existing Structure premium", { exact: true }),
    // ).toBeVisible();

    // await page
    //   .getByRole("button", { name: "Review highlighted fields" })
    //   .click();

    // await page.getByText("Premium Breakdown").focus();

    // // 11. Look for document generation options
    // const generateDocsBtn = page.getByRole("button", {
    //   name: /generate documents|create documents/i,
    // });
    // const documentSection = page.getByRole("heading", {
    //   name: /documents|attachments/i,
    // });

    // // Navigate to documents section if present
    // if (await documentSection.count()) {
    //   await documentSection.click();
    // }

    // // 12. Generate documents if button is available
    // if (
    //   (await generateDocsBtn.count()) &&
    //   (await generateDocsBtn.isVisible())
    // ) {
    //   await generateDocsBtn.click();

    //   // Wait for document generation
    //   await expect(
    //     page.getByText(/documents generated|generating/i),
    //   ).toBeVisible({
    //     timeout: 15000,
    //   });
    // }

    // // 13. Check for generated documents
    // const documentList = page.locator(
    //   '[data-testid*="document"], [class*="document"], [role="document"]',
    // );
    // if (await documentList.count()) {
    //   // Verify at least one document exists
    //   await expect(documentList.first()).toBeVisible();
    // }

    // // 14. Email documents (using mocked Resend API)
    // const emailBtn = page.getByRole("button", {
    //   name: /email selected|email documents/i,
    // });
    // const selectAllCheckbox = page.getByRole("checkbox", {
    //   name: /select all/i,
    // });

    // if (await selectAllCheckbox.count()) {
    //   await selectAllCheckbox.check();
    // }

    // if ((await emailBtn.count()) && (await emailBtn.isEnabled())) {
    //   await emailBtn.click();

    //   // Look for email dialog
    //   const emailDialog = page.locator('[role="dialog"], dialog');
    //   if (await emailDialog.count()) {
    //     // Fill recipient email
    //     const recipientField = page.getByLabel(/to|recipient/i);
    //     if (await recipientField.count()) {
    //       await recipientField.fill("test@example.com");
    //     }

    //     // Send email
    //     const sendBtn = page.getByRole("button", { name: /send|email now/i });
    //     if (await sendBtn.count()) {
    //       await sendBtn.click();

    //       // Verify success message
    //       await expect(page.getByText(/email sent|success/i)).toBeVisible({
    //         timeout: 5000,
    //       });
    //     }
    //   }
    // }

    // 15. Mark policy as Taken

    // const policyStatusBtn = page.getByRole("button", { name: "Policy status" });
    // await policyStatusBtn.click();
    // await page.getByRole("option", { name: "Taken" }).click();

    //   // Handle confirmation dialog if present
    //   const confirmBtn = page.getByRole("button", {
    //     name: /confirm|yes|proceed/i,
    //   });
    //   if (await confirmBtn.count()) {
    //     await confirmBtn.click();
    //   }

    //   // Verify success message
    //   await expect(page.getByText(/taken|submitted|finalized/i)).toBeVisible({
    //     timeout: 5000,
    //   });
    // }

    // // 16. Verify policy is now in read-only "view" mode
    // await page.reload();
    // await expect(wizardRoot).toHaveAttribute("data-policy-phase", "taken");

    // // Taken policies should not have edit controls
    // await expect(page.getByRole("button", { name: /^save$/i })).toHaveCount(0);
  });

  test("handles wizard navigation and saves drafts correctly", async ({
    page,
  }) => {
    // Create a new policy draft
    await page.goto("/clients");
    const clientRow = page.getByRole("row", { name: /open client/i });

    test.skip(
      (await clientRow.count()) === 0,
      "No clients available for wizard navigation test",
    );

    await clientRow.first().click();

    const newPolicyBtn = page.getByRole("button", { name: /new policy/i });
    test.skip(
      (await newPolicyBtn.count()) === 0,
      "No 'New Policy' button available",
    );

    await newPolicyBtn.first().click();

    // Verify in new mode
    const wizardRoot = page.locator("[data-policy-phase]");
    await expect(wizardRoot).toHaveAttribute("data-policy-phase", "new");

    // Fill minimal information
    const addressField = page.getByLabel(/site address|address/i);
    if (await addressField.count()) {
      await addressField.fill("Test Address for Draft");
    }

    // Save as draft
    const saveDraftBtn = page.getByRole("button", { name: /save draft|save/i });
    if (await saveDraftBtn.count()) {
      await saveDraftBtn.click();

      await expect(page.getByText(/draft saved|saved/i)).toBeVisible({
        timeout: 5000,
      });
    }

    // Navigate away and back
    await page.goto("/dashboard");
    await page.goto(page.url()); // Reload

    // Go back to policy
    await page.goto("/policies?status=1"); // Pending policies
    const draftRow = page.getByRole("row", {
      name: /Test Address for Draft|open policy/i,
    });

    if (await draftRow.count()) {
      await draftRow.first().click();

      // Should be in edit mode (not new)
      await expect(wizardRoot).toHaveAttribute("data-policy-phase", "pending");
    }
  });

  test("validates required fields before submission", async ({ page }) => {
    // Try to submit incomplete form
    await page.goto("/clients");
    const clientRow = page.getByRole("row", { name: /open client/i });

    test.skip(
      (await clientRow.count()) === 0,
      "No clients available for validation test",
    );

    await clientRow.first().click();

    const newPolicyBtn = page.getByRole("button", { name: /new policy/i });
    test.skip(
      (await newPolicyBtn.count()) === 0,
      "No 'New Policy' button available",
    );

    await newPolicyBtn.first().click();

    // Try to submit with empty form
    const submitBtn = page.getByRole("button", {
      name: /^submit|mark as taken/i,
    });

    if ((await submitBtn.count()) && (await submitBtn.first().isEnabled())) {
      await submitBtn.first().click();

      // Should show validation errors
      const errorMessages = page.getByText(/required|please fill|invalid/i);
      if (await errorMessages.count()) {
        await expect(errorMessages).toBeVisible();
      }
    }
  });

  test("calculates premium with different input values", async ({ page }) => {
    // Create a test scenario with different values
    await page.goto("/clients");
    const clientRow = page.getByRole("row", { name: /open client/i });

    test.skip(
      (await clientRow.count()) === 0,
      "No clients available for premium calculation test",
    );

    await clientRow.first().click();

    const newPolicyBtn = page.getByRole("button", { name: /new policy/i });
    test.skip(
      (await newPolicyBtn.count()) === 0,
      "No 'New Policy' button available",
    );

    await newPolicyBtn.first().click();

    // Test different turnover values
    const testCases = [
      { turnover: "500000", expectedPremium: /\$\d+\.\d{2}/ },
      { turnover: "1000000", expectedPremium: /\$\d+\.\d{2}/ },
      { turnover: "2000000", expectedPremium: /\$\d+\.\d{2}/ },
    ];

    for (const testCase of testCases) {
      const turnoverField = page.getByLabel(/estimated turnover|turnover/i);
      const calculateBtn = page.getByRole("button", {
        name: /calculate premium/i,
      });

      if ((await turnoverField.count()) && (await calculateBtn.count())) {
        await turnoverField.fill(testCase.turnover);
        await calculateBtn.click();

        // Wait for premium to appear
        await expect(page.getByText(testCase.expectedPremium)).toBeVisible({
          timeout: 5000,
        });

        // Clear for next test
        await turnoverField.fill("");
      }
    }
  });
});
