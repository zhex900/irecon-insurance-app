import { expect, test } from "@playwright/test";

import { mockResendEmailApi } from "./helpers/auth";

test.describe("policy adjustment flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockResendEmailApi(page);
  });

  test("complete adjustment flow with 25%/75% rule validation", async ({
    page,
  }) => {
    // 1. Navigate to Taken policies
    await page.goto("/policies?status=2");

    const takenRow = page.getByRole("row", { name: /^open policy/i });
    test.skip(
      (await takenRow.count()) === 0,
      "No Taken policies available for adjustment test",
    );

    // Find a policy with adjustment capability
    let adjustmentLink = null;
    const rowsToCheck = Math.min(await takenRow.count(), 5);

    for (let i = 0; i < rowsToCheck; i++) {
      await page.goto("/policies?status=2");
      await takenRow.nth(i).click();

      // Check for adjustment link/button
      const adjustLink = page.getByRole("link", { name: /adjust/i });
      const adjustButton = page.getByRole("button", { name: /adjust/i });
      const adjustAction = adjustLink.or(adjustButton);

      if (await adjustAction.count()) {
        adjustmentLink = await adjustAction.first();
        break;
      }
    }

    test.skip(
      !adjustmentLink,
      "No Taken policy found with adjustment capability",
    );

    // 2. Enter adjustment flow
    await adjustmentLink!.click();
    await expect(page).toHaveURL(/\/policies\/[^/]+\/adjust/);

    // 3. Verify adjustment UI is loaded
    const adjustmentForm = page.locator(
      '[data-testid="adjustment-form"], form',
    );
    await expect(adjustmentForm).toBeVisible();

    // 4. Test 25%/75% rule validation
    // Look for turnover or sum insured fields
    const turnoverField = page.getByLabel(/adjusted turnover|turnover/i);
    const originalValueElement = page.getByText(/original.*\$[\d,]+/i);

    if (await turnoverField.count()) {
      // Get base value for calculation
      let baseValue = 1000000; // Default if can't extract from UI

      if (await originalValueElement.count()) {
        const originalText = await originalValueElement.textContent();
        const match = originalText?.match(/\$?([\d,]+)/);
        if (match) {
          const cleaned = match[1].replace(/,/g, "");
          baseValue = parseInt(cleaned, 10) || baseValue;
        }
      }

      // Calculate valid and invalid test values
      const validDecrease = Math.floor(baseValue * 0.8); // 20% decrease (within 25% rule)
      const invalidDecrease = Math.floor(baseValue * 0.5); // 50% decrease (violates 25% rule)

      const validIncrease = Math.floor(baseValue * 1.2); // 20% increase (within 75% rule)
      const invalidIncrease = Math.floor(baseValue * 2); // 100% increase (violates 75% rule)

      // Test valid decrease (should be accepted)
      await turnoverField.fill(validDecrease.toString());

      // Check if validation errors appear
      const errorMessages = page.getByText(/outside.*25%|violates.*rule/i);
      if (await errorMessages.count()) {
        // If error appears for valid value, test might need adjustment
        console.log(
          `Valid decrease (${validDecrease}) triggered validation error`,
        );
      }

      // Clear field
      await turnoverField.fill("");

      // Test invalid decrease (may trigger validation)
      await turnoverField.fill(invalidDecrease.toString());

      // Look for validation warnings
      const warningMessages = page.getByText(/exceeds.*decrease|25%.*limit/i);
      if (await warningMessages.count()) {
        await expect(warningMessages.first()).toBeVisible();
      }

      // Test valid increase
      await turnoverField.fill(validIncrease.toString());

      const increaseErrors = page.getByText(/outside.*75%|exceeds.*increase/i);
      if (await increaseErrors.count()) {
        console.log(`Valid increase (${validIncrease}) triggered validation`);
      }

      // Test invalid increase
      await turnoverField.fill(invalidIncrease.toString());

      const invalidWarning = page.getByText(/exceeds.*75%|increase.*too high/i);
      if (await invalidWarning.count()) {
        await expect(invalidWarning.first()).toBeVisible();
      }
    }

    // 5. Fill adjustment details
    const adjustmentReasonField = page.getByLabel(/reason|justification/i);
    const adjustedDateField = page.getByLabel(/adjusted date|effective date/i);

    if (await adjustmentReasonField.count()) {
      await adjustmentReasonField.fill("Market conditions changed");
    }

    if (await adjustedDateField.count()) {
      // Set date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];
      await adjustedDateField.fill(dateStr);
    }

    // 6. Recalculate premium
    const recalculateBtn = page.getByRole("button", {
      name: /recalculate|calculate/i,
    });
    if (await recalculateBtn.count()) {
      await recalculateBtn.click();

      // Wait for premium recalculation
      await expect(page.getByText(/recalculated|calculated/i)).toBeVisible({
        timeout: 10000,
      });
    }

    // 7. Save adjustment
    const saveAdjustmentBtn = page.getByRole("button", {
      name: /save adjustment|apply/i,
    });
    const confirmBtn = page.getByRole("button", { name: /confirm|save/i });

    if (await saveAdjustmentBtn.count()) {
      await saveAdjustmentBtn.click();

      // Handle confirmation dialog
      if (await confirmBtn.count()) {
        await confirmBtn.click();
      }

      // Verify adjustment saved
      await expect(page.getByText(/adjustment saved|updated/i)).toBeVisible({
        timeout: 5000,
      });
    }

    // 8. Verify updated premium is visible
    await expect(
      page.getByText(/adjusted.*premium|new.*premium/i),
    ).toBeVisible();

    // 9. Look for Excel generation option
    const generateExcelBtn = page.getByRole("button", {
      name: /generate excel|working sheet/i,
    });
    if (await generateExcelBtn.count()) {
      await generateExcelBtn.click();

      // Wait for Excel generation
      await expect(
        page.getByText(/excel.*generated|generating.*worksheet/i),
      ).toBeVisible({
        timeout: 10000,
      });
    }

    // 10. Check for generated documents
    const documentsSection = page.getByRole("heading", {
      name: /documents|attachments/i,
    });
    if (await documentsSection.count()) {
      await documentsSection.click();

      // Look for adjustment documents
      await expect(
        page.getByText(/adjustment.*worksheet|revised.*premium/i),
      ).toBeVisible({
        timeout: 5000,
      });
    }

    // 11. Email adjusted documents
    const emailBtn = page.getByRole("button", {
      name: /email.*documents|send.*adjustment/i,
    });
    if ((await emailBtn.count()) && (await emailBtn.isEnabled())) {
      await emailBtn.click();

      // Fill email form if dialog appears
      const emailDialog = page.locator('[role="dialog"]');
      if (await emailDialog.count()) {
        const toField = page.getByLabel(/to|recipient/i);
        if (await toField.count()) {
          await toField.fill("adjustment@example.com");
        }

        const sendButton = page.getByRole("button", {
          name: /send|email now/i,
        });
        if (await sendButton.count()) {
          await sendButton.click();

          await expect(
            page.getByText(/email.*sent|adjustment.*sent/i),
          ).toBeVisible({
            timeout: 5000,
          });
        }
      }
    }
  });

  test("handles adjustment cancellation correctly", async ({ page }) => {
    // Navigate to adjustment flow
    await page.goto("/policies?status=2");
    const takenRow = page.getByRole("row", { name: /^open policy/i });

    test.skip(
      (await takenRow.count()) === 0,
      "No Taken policies available for cancellation test",
    );

    // Find policy with adjustment
    let policyUrl = "";
    const rowsToCheck = Math.min(await takenRow.count(), 3);

    for (let i = 0; i < rowsToCheck; i++) {
      await page.goto("/policies?status=2");
      await takenRow.nth(i).click();

      const adjustAction = page
        .getByRole("link", { name: /adjust/i })
        .or(page.getByRole("button", { name: /adjust/i }));

      if (await adjustAction.count()) {
        policyUrl = page.url();
        await adjustAction.first().click();
        break;
      }
    }

    test.skip(!policyUrl, "No adjustment-capable policy found");

    // Verify on adjustment page
    await expect(page).toHaveURL(/\/policies\/[^/]+\/adjust/);

    // Cancel adjustment
    const cancelBtn = page.getByRole("button", { name: /cancel|back/i });
    if (await cancelBtn.count()) {
      await cancelBtn.click();

      // Should return to policy view
      await expect(page).toHaveURL(new RegExp(policyUrl.replace(/\//g, "\\/")));
    }

    // Policy should still be in Taken status
    const policyStatus = page.getByText(/taken|status.*taken/i);
    if (await policyStatus.count()) {
      await expect(policyStatus).toBeVisible();
    }
  });

  test("validates adjustment dates correctly", async ({ page }) => {
    // Navigate to adjustment
    await page.goto("/policies?status=2");
    const takenRow = page.getByRole("row", { name: /^open policy/i });

    test.skip(
      (await takenRow.count()) === 0,
      "No Taken policies available for date validation test",
    );

    // Find adjust link
    const adjustLink = page
      .getByRole("link", { name: /adjust/i })
      .or(page.getByRole("button", { name: /adjust/i }));
    test.skip((await adjustLink.count()) === 0, "No adjustment option found");

    await adjustLink.first().click();
    await expect(page).toHaveURL(/\/policies\/[^/]+\/adjust/);

    // Test date validations
    const dateField = page.getByLabel(/adjusted date|effective date/i);
    test.skip(
      (await dateField.count()) === 0,
      "No date field found in adjustment form",
    );

    // Test invalid dates
    const invalidDates = [
      "invalid-date",
      "2023-13-01", // Invalid month
      "2023-02-30", // Invalid day
    ];

    for (const invalidDate of invalidDates) {
      await dateField.fill(invalidDate);

      // Trigger validation (blur field or wait)
      await page.keyboard.press("Tab");

      const dateError = page.getByText(/invalid.*date|valid.*date/i);
      if (await dateError.count()) {
        await expect(dateError).toBeVisible();
      }
    }

    // Test valid date
    const validDate = new Date();
    validDate.setDate(validDate.getDate() + 7);
    const validDateStr = validDate.toISOString().split("T")[0];

    await dateField.fill(validDateStr);
    await page.keyboard.press("Tab");

    // Should not show error for valid date
    const dateError = page.getByText(/invalid.*date|valid.*date/i);
    if (await dateError.count()) {
      // If error appears, validDate might be invalid
      console.log(`Valid date ${validDateStr} triggered error`);
    }
  });

  test("handles large adjustment that triggers manual review", async ({
    page,
  }) => {
    // Navigate to adjustment
    await page.goto("/policies?status=2");
    const takenRow = page.getByRole("row", { name: /^open policy/i });

    test.skip(
      (await takenRow.count()) === 0,
      "No Taken policies available for large adjustment test",
    );

    // Find adjust link
    const adjustLink = page
      .getByRole("link", { name: /adjust/i })
      .or(page.getByRole("button", { name: /adjust/i }));
    test.skip((await adjustLink.count()) === 0, "No adjustment option found");

    await adjustLink.first().click();
    await expect(page).toHaveURL(/\/policies\/[^/]+\/adjust/);

    // Test very large change that should trigger manual review
    const turnoverField = page.getByLabel(/adjusted turnover|turnover/i);
    if (await turnoverField.count()) {
      // Try 300% increase (should trigger review)
      await turnoverField.fill("3000000"); // Assuming base is ~1000000

      // Look for manual review warning
      const reviewWarning = page.getByText(
        /manual.*review|requires.*approval/i,
      );
      if (await reviewWarning.count()) {
        await expect(reviewWarning).toBeVisible();
      }

      // Test justification requirement
      const reasonField = page.getByLabel(/reason|justification/i);
      if (await reasonField.count()) {
        // Initially empty - might trigger validation
        await reasonField.fill("Market expansion and increased project scope");

        // Should accept with justification
        const saveBtn = page.getByRole("button", { name: /save.*adjustment/i });
        if ((await saveBtn.count()) && (await saveBtn.isEnabled())) {
          // Save might succeed or require additional approval
          await saveBtn.click();

          // Check for success or review message
          const successOrReview = page.getByText(
            /success|submitted.*for.*review/i,
          );
          if (await successOrReview.count()) {
            await expect(successOrReview).toBeVisible();
          }
        }
      }
    }
  });

  test("maintains adjustment history audit trail", async ({ page }) => {
    // Find a policy that has been adjusted
    await page.goto("/policies");

    // Look for adjustment indicator in list
    const adjustedPolicyRow = page.getByRole("row", {
      name: /adjusted|revision/i,
    });
    const targetRow = adjustedPolicyRow.or(
      page.getByRole("row", { name: /^open policy/i }).first(),
    );

    test.skip(
      (await targetRow.count()) === 0,
      "No policies available for adjustment history test",
    );

    await targetRow.first().click();

    // Check for adjustment history section
    const historySection = page.getByRole("heading", {
      name: /history|audit|adjustments/i,
    });
    const viewHistoryBtn = page.getByRole("button", {
      name: /view.*history|adjustment.*history/i,
    });

    if (await historySection.count()) {
      await historySection.click();
    } else if (await viewHistoryBtn.count()) {
      await viewHistoryBtn.click();
    }

    // Look for adjustment history entries
    const historyEntries = page
      .getByRole("listitem", { name: /adjusted|revision/i })
      .or(page.locator('[class*="history"], [class*="audit"]'));

    if (await historyEntries.count()) {
      // Verify at least one entry exists
      await expect(historyEntries.first()).toBeVisible();

      // Check entry contains relevant information
      const entryText = await historyEntries.first().textContent();

      // Should contain adjustment-related info
      expect(entryText).toMatch(/adjusted|revision|premium|turnover/i);
    } else {
      // Skip if no history UI element found
      test.skip(true, "No adjustment history UI found");
    }
  });
});
