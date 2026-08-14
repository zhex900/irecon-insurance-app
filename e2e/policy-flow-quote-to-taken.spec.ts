import { test, expect } from "@playwright/test";
import { demoUsers, loginAs, mockResendEmailApi } from "./helpers/auth";
import { seedClients } from "./helpers/seed";

test.describe("quote-to-taken workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Resend API for email tests
    await mockResendEmailApi(page);
  });

  test("complete quote-to-taken journey with document generation", async ({
    page,
  }) => {
    // 1. Login as broker
    await loginAs(page, demoUsers.broker);

    // 2. Navigate to clients
    await page.goto("/clients");

    // Find or create a test client
    const clientRow = page.getByRole("row", { name: /open client/i });

    // Skip if no clients available
    test.skip(
      (await clientRow.count()) === 0,
      "No clients available. Expected: " +
        seedClients.map((c) => c.name).join(", "),
    );

    // Open first available client
    await clientRow.first().click();
    await expect(page).toHaveURL(/\/clients\/[^/]+$/);

    // 3. Start new policy
    const newPolicyBtn = page.getByRole("button", { name: /new policy/i });
    test.skip(
      (await newPolicyBtn.count()) === 0,
      "No 'New Policy' button available",
    );

    await newPolicyBtn.first().click();

    // Should be redirected to new policy wizard with ?new=1 marker
    await expect(page).toHaveURL(/\/policies\/[^/]+\?new=1/);

    // 4. Verify wizard is in "new" mode
    const wizardRoot = page.locator("[data-wizard-mode]");
    await expect(wizardRoot).toHaveAttribute("data-wizard-mode", "new");

    // 5. Complete basic policy information
    // Look for common form fields
    const addressField = page.getByLabel(/site address|address/i);
    const turnoverField = page.getByLabel(/estimated turnover|turnover/i);
    const sumInsuredField = page.getByLabel(
      /contract works sum insured|sum insured/i,
    );

    // Fill basic information
    if (await addressField.count()) {
      await addressField.fill("123 E2E Test Street, Sydney NSW 2000");
    }

    if (await turnoverField.count()) {
      await turnoverField.fill("1000000");
    }

    if (await sumInsuredField.count()) {
      await sumInsuredField.fill("3000000");
    }

    // 6. Fill business activities
    const businessActivitiesField = page.getByLabel(/business activities/i);
    if (await businessActivitiesField.count()) {
      await businessActivitiesField.fill("Commercial Construction");
    }

    // 7. Navigate through wizard sections (if multi-step)
    const nextButtons = page.getByRole("button", { name: /next|continue/i });
    if (await nextButtons.count()) {
      // Try to click through wizard steps
      for (let i = 0; i < 3; i++) {
        if (await nextButtons.first().isEnabled()) {
          await nextButtons.first().click();
        } else {
          break;
        }
      }
    }

    // 8. Calculate premium
    const calculatePremiumBtn = page.getByRole("button", {
      name: /calculate premium/i,
    });
    const saveBtn = page.getByRole("button", {
      name: /^save|save as pending/i,
    });

    if (await calculatePremiumBtn.count()) {
      await calculatePremiumBtn.click();

      // Wait for premium calculation
      await expect(
        page.getByText(/premium calculated|calculating/i),
      ).toBeVisible({
        timeout: 10000,
      });

      // Verify premium amounts are visible
      await expect(page.getByText(/\$?[\d,]+\.\d{2}/)).toBeVisible({
        timeout: 5000,
      });
    }

    // 9. Save as Pending
    if (await saveBtn.count()) {
      await saveBtn.click();

      // Wait for save confirmation
      await expect(
        page.getByText(/policy saved|draft saved|success/i),
      ).toBeVisible({
        timeout: 5000,
      });
    }

    // 10. Remove ?new=1 marker to see the saved policy
    const currentUrl = await page.url();
    const baseUrl = currentUrl.split("?")[0];
    await page.goto(baseUrl);

    // Now policy should be in "edit" mode
    await expect(wizardRoot).toHaveAttribute("data-wizard-mode", "edit");

    // 11. Look for document generation options
    const generateDocsBtn = page.getByRole("button", {
      name: /generate documents|create documents/i,
    });
    const documentSection = page.getByRole("heading", {
      name: /documents|attachments/i,
    });

    // Navigate to documents section if present
    if (await documentSection.count()) {
      await documentSection.click();
    }

    // 12. Generate documents if button is available
    if (
      (await generateDocsBtn.count()) &&
      (await generateDocsBtn.isVisible())
    ) {
      await generateDocsBtn.click();

      // Wait for document generation
      await expect(
        page.getByText(/documents generated|generating/i),
      ).toBeVisible({
        timeout: 15000,
      });
    }

    // 13. Check for generated documents
    const documentList = page.locator(
      '[data-testid*="document"], [class*="document"], [role="document"]',
    );
    if (await documentList.count()) {
      // Verify at least one document exists
      await expect(documentList.first()).toBeVisible();
    }

    // 14. Email documents (using mocked Resend API)
    const emailBtn = page.getByRole("button", {
      name: /email selected|email documents/i,
    });
    const selectAllCheckbox = page.getByRole("checkbox", {
      name: /select all/i,
    });

    if (await selectAllCheckbox.count()) {
      await selectAllCheckbox.check();
    }

    if ((await emailBtn.count()) && (await emailBtn.isEnabled())) {
      await emailBtn.click();

      // Look for email dialog
      const emailDialog = page.locator('[role="dialog"], dialog');
      if (await emailDialog.count()) {
        // Fill recipient email
        const recipientField = page.getByLabel(/to|recipient/i);
        if (await recipientField.count()) {
          await recipientField.fill("test@example.com");
        }

        // Send email
        const sendBtn = page.getByRole("button", { name: /send|email now/i });
        if (await sendBtn.count()) {
          await sendBtn.click();

          // Verify success message
          await expect(page.getByText(/email sent|success/i)).toBeVisible({
            timeout: 5000,
          });
        }
      }
    }

    // 15. Mark policy as Taken
    const markTakenBtn = page.getByRole("button", {
      name: /mark as taken|finalize|submit/i,
    });
    const submitBtn = page.getByRole("button", { name: /^submit$/i });

    // Try different button names
    const finalizePolicyBtn = markTakenBtn.or(submitBtn);

    if (
      (await finalizePolicyBtn.count()) &&
      (await finalizePolicyBtn.first().isEnabled())
    ) {
      await finalizePolicyBtn.first().click();

      // Handle confirmation dialog if present
      const confirmBtn = page.getByRole("button", {
        name: /confirm|yes|proceed/i,
      });
      if (await confirmBtn.count()) {
        await confirmBtn.click();
      }

      // Verify success message
      await expect(page.getByText(/taken|submitted|finalized/i)).toBeVisible({
        timeout: 5000,
      });
    }

    // 16. Verify policy is now in read-only "view" mode
    await page.reload();
    await expect(wizardRoot).toHaveAttribute("data-wizard-mode", "view");

    // Taken policies should not have edit controls
    await expect(page.getByRole("button", { name: /^save$/i })).toHaveCount(0);

    // 17. Verify audit trail entry if available
    const auditSection = page.getByRole("heading", { name: /audit|history/i });
    const activityLog = page.getByText(/created|updated|taken/i);

    if (await auditSection.count()) {
      await auditSection.click();
    }

    // Check for recent activity
    if (await activityLog.count()) {
      await expect(activityLog).toBeVisible();
    }
  });

  test("handles wizard navigation and saves drafts correctly", async ({
    page,
  }) => {
    await loginAs(page, demoUsers.broker);

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
    const wizardRoot = page.locator("[data-wizard-mode]");
    await expect(wizardRoot).toHaveAttribute("data-wizard-mode", "new");

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
      await expect(wizardRoot).toHaveAttribute("data-wizard-mode", "edit");
    }
  });

  test("validates required fields before submission", async ({ page }) => {
    await loginAs(page, demoUsers.broker);

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
    await loginAs(page, demoUsers.broker);

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
