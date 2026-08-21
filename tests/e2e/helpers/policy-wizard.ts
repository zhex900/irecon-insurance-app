import { expect, type Locator, type Page } from "@playwright/test";

/** Root element carrying `data-policy-phase`. */
export function wizardRoot(page: Page): Locator {
  return page.locator("[data-policy-phase]");
}

export async function expectPolicyPhase(
  page: Page,
  phase: string | RegExp,
  options?: { timeout?: number },
): Promise<void> {
  await expect(wizardRoot(page)).toHaveAttribute(
    "data-policy-phase",
    phase,
    options,
  );
}

export async function openFirstClientAndStartPolicy(page: Page): Promise<void> {
  await page.goto("/clients");
  await expect(
    page.getByRole("heading", { name: /clients directory/i }),
  ).toBeVisible();

  await page.waitForLoadState("networkidle");
  const clientRow = page.getByRole("row", { name: /^open client/i }).first();
  await clientRow.click();
  await expect(page).toHaveURL(/\/clients\/[^/]+$/);
  // await expect(clientRow).toBeVisible();

  // const clientId = await clientRow.getAttribute("data-client-id");
  // if (!clientId) {
  //   throw new Error("Expected client row to expose data-client-id");
  // }
  // await page.goto(`/clients/${clientId}`);
  // await expect(page).toHaveURL(new RegExp(`/clients/${clientId}`));

  const newPolicyButton = page.getByRole("button", { name: /new policy/i });
  await expect(newPolicyButton.first()).toBeVisible();
  await newPolicyButton.first().click();
  await expect(page).toHaveURL(/\/policies\/[^/]+\?new=1/);
  await expectPolicyPhase(page, "new");
}

/** Radix select wired through `FieldLabel` + `AppSelect`. */
export async function selectFieldOption(
  page: Page,
  label: RegExp,
  option: RegExp,
): Promise<void> {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option }).click();
}

export async function fillState(page: Page, code: string): Promise<void> {
  const stateInput = page.getByRole("combobox", { name: /^State$/i });
  await stateInput.click();
  await stateInput.fill(code);
  await page
    .locator("#stateId-listbox")
    .getByRole("button", { name: code })
    .click();
}

async function pickDateButton(page: Page, index: number): Promise<void> {
  await page
    .getByRole("button", { name: /^Pick a date$/i })
    .nth(index)
    .click();
}

export async function fillPolicyDates(page: Page): Promise<void> {
  const start = new Date();
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 6);

  await pickDateButton(page, 0);
  await page
    .getByRole("gridcell", { name: String(start.getDate()), exact: true })
    .first()
    .click();

  await pickDateButton(page, 0);
  await page
    .getByRole("gridcell", { name: String(end.getDate()), exact: true })
    .first()
    .click();
}

export async function fillAmountField(
  page: Page,
  label: RegExp,
  value: string,
): Promise<void> {
  await page.getByLabel(label).fill(value);
}

async function goToSectionId(page: Page, sectionId: string): Promise<void> {
  await page.locator(`a[href="#${sectionId}"]`).first().click();
  await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded();
}

export async function fillVisibleEmptyInputs(
  section: Locator,
  value: string,
): Promise<void> {
  const inputs = section.locator('input:not([type="hidden"])');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    if ((await input.inputValue()) === "") {
      await input.fill(value);
    }
  }
}

export type FillPolicyOptions = {
  insuredName: string;
  siteAddress?: string;
  turnover?: string;
};

/** Fill required CAR wizard fields for a Single / New policy. */
export async function fillRequiredPolicyForm(
  page: Page,
  options: FillPolicyOptions,
): Promise<void> {
  const {
    insuredName,
    siteAddress = "123 E2E Test Street, Sydney NSW 2000",
    turnover = "1000000",
  } = options;

  await selectFieldOption(page, /^Insurer$/i, /^ATC$/i);
  await page.getByLabel(/^Insured Name$/i).fill(insuredName);
  await selectFieldOption(page, /^Type of Cover$/i, /^Single$/i);
  await selectFieldOption(page, /^Policy Category$/i, /^New$/i);

  await page.getByLabel(/^Site Address$/i).fill(siteAddress);
  await fillState(page, "NSW");
  await page.getByLabel(/^Postcode$/i).fill("2000");

  await fillAmountField(
    page,
    /^Estimated Turnover \/ Project Value$/i,
    turnover,
  );
  await page
    .getByLabel(/^Business Activities$/i)
    .fill("Commercial construction and associated civil works");

  await page.getByLabel(/^Maximum Maintenance Period \(months\)$/i).fill("12");

  await fillPolicyDates(page);

  await selectFieldOption(
    page,
    /^Do you hold a current contract works\/liability policy\?$/i,
    /^No$/i,
  );

  await goToSectionId(page, "limits-of-liability");
  await fillAmountField(page, /^Contract Works$/i, "1500000");
  await fillAmountField(page, /^Display Homes$/i, "0");
  await fillAmountField(page, /^Existing Structures$/i, "0");
  await fillAmountField(
    page,
    /^Named Insureds Construction Plant & Equipment$/i,
    "10000",
  );
  await selectFieldOption(page, /^Limit of Liability$/i, /\$10 Million/i);

  await goToSectionId(page, "excesses");
  await fillVisibleEmptyInputs(page.locator("#excesses"), "1000");

  await goToSectionId(page, "claims");
  await page.getByLabel(/^Number of claims last 3 years$/i).fill("0");
  await selectFieldOption(
    page,
    /^Have any claims exceeded \$20,000 in value\?$/i,
    /^No$/i,
  );
  await page
    .getByRole("checkbox", {
      name: /Confirm you have asked and received responses/i,
    })
    .check();
}

export async function waitForPremiumCalculation(page: Page): Promise<void> {
  await goToSectionId(page, "premium");
  await expect(
    page.getByText(/Premium has not been calculated yet/i),
  ).not.toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/\$[\d,]+\.\d{2}/).first()).toBeVisible({
    timeout: 45_000,
  });
}

export async function submitPolicy(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /^submit$/i })
    .first()
    .click();
  const submitDialog = page.getByRole("dialog", { name: /Submit policy\?/i });
  await expect(submitDialog).toBeVisible();
  await page.getByRole("button", { name: /Confirm & generate/i }).click();
  await expect(submitDialog).toBeHidden({ timeout: 90_000 });
  await expectPolicyPhase(page, "pending", { timeout: 90_000 });
}

export async function markPolicyTaken(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Policy status$/i }).click();
  await page.getByRole("menuitem", { name: /^Taken$/i }).click();
  await expect(
    page.getByRole("dialog", { name: /Mark policy as Taken\?/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Confirm$/i }).click();
  await expectPolicyPhase(page, "taken", { timeout: 45_000 });
}
