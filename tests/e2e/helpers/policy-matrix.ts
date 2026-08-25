import { expect, type Page, type Response } from "@playwright/test";

import {
  getPolicyMatrixFixture,
  listPolicyMatrixScenarioIds,
  type PolicyMatrixExpected,
  type PolicyMatrixExpectedPremium,
  type PolicyMatrixInput,
  policyMatrixManifest,
} from "../fixtures/policy-matrix";
import { expectPolicyPhase } from "./policy-wizard";

export type {
  PolicyMatrixExpected,
  PolicyMatrixExpectedPremium,
  PolicyMatrixFormInput,
  PolicyMatrixInput,
} from "../fixtures/policy-matrix";

function formatAudCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function loadPolicyMatrixManifest() {
  return policyMatrixManifest;
}

export function loadPolicyMatrixFixture(scenarioId: string): {
  input: PolicyMatrixInput;
  expected: PolicyMatrixExpected;
} {
  return getPolicyMatrixFixture(scenarioId);
}

export function listPolicyMatrixScenarios(priority?: string): string[] {
  return listPolicyMatrixScenarioIds(priority);
}

function policyIdFromUrl(page: Page): string {
  const policyId = page.url().split("/").pop()?.split("?")[0];
  if (!policyId) {
    throw new Error(`Expected policy id in URL, got ${page.url()}`);
  }
  return policyId;
}

export async function selectCoverType(
  page: Page,
  coverTypeName: string,
): Promise<void> {
  const coverCombo = page.getByRole("combobox", { name: "Type of Cover" });
  await coverCombo.click();
  await page.getByRole("option", { name: coverTypeName, exact: true }).click();
}

/** Fill wizard from a matrix input fixture (deterministic values). */
export async function fillPolicyFormFromFixture(
  page: Page,
  input: PolicyMatrixInput,
): Promise<{
  postPolicyDataPromise: Promise<Response>;
  getReferenceFeeNamesPromise: Promise<Response>;
  policyId: string;
}> {
  const { form, coverTypeName, annualCoverTypeName } = input;

  if (coverTypeName !== "Annual") {
    await selectCoverType(page, coverTypeName);
  }

  await page
    .getByRole("textbox", { name: "Insured Name" })
    .fill(form.insuredName);

  if (annualCoverTypeName) {
    await page.getByRole("combobox", { name: "Annual Type of Cover" }).click();
    await page
      .getByRole("option", { name: annualCoverTypeName, exact: true })
      .click();
  }

  await page
    .getByRole("textbox", { name: "Site Address" })
    .fill(form.siteAddress);
  await page.getByRole("textbox", { name: "Postcode" }).fill(form.postcode);
  await page.getByRole("combobox", { name: "State" }).fill(form.state);

  //enter
  await page.keyboard.press("Enter");

  await page
    .getByRole("textbox", { name: "Estimated Turnover / Project" })
    .fill(form.estimatedTurnover.toString());

  await page.getByRole("combobox", { name: "Do you hold a current" }).click();
  await page
    .getByRole("option", {
      name: form.hasExistingContractWorksCover,
      exact: true,
    })
    .click();

  await page
    .getByRole("textbox", { name: "Contract Works" })
    .fill(form.contractWorksSumInsured.toString());
  await page
    .getByRole("textbox", { name: "Display Homes" })
    .fill(form.displayHomes.toString());
  await page
    .getByRole("textbox", { name: "Existing Structures" })
    .fill(form.existingStructure.toString());
  await page
    .locator('input[name="plantEquipment"]')
    .fill(form.plantEquipment.toString());

  await page.getByRole("combobox", { name: "Limit of Liability" }).click();
  await page
    .getByRole("option", { name: form.liabilityLimitBand, exact: true })
    .click();

  await page
    .getByRole("combobox", { name: /Have any claims exceeded \$20/i })
    .click();
  await page
    .getByRole("listbox")
    .getByRole("option", { name: form.anyClaimsExceed20k, exact: true })
    .click();

  const policyId = policyIdFromUrl(page);

  const postPolicyDataPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`policies/${policyId}.data`) &&
      response.request().method() === "POST",
  );
  const getReferenceFeeNamesPromise = page.waitForResponse(
    "**/api/reference/fee-names.data*",
  );

  await page
    .getByRole("textbox", { name: "Number of claims last 3 years" })
    .fill(String(form.claimsCountLast3Years));

  await expect(
    page.getByRole("button", { name: "Submit" }).first(),
  ).toBeDisabled();

  if (form.declarationConfirmed) {
    await page.getByText(/confirm you have asked and/i).click({ force: true });
  }
  if (form.unsealedRoadworksConfirmed) {
    await page
      .getByRole("checkbox", { name: "Unsealed Roadworks The" })
      .click({ force: true });
  }

  await expect(
    page.getByRole("button", { name: "Submit" }).first(),
  ).toBeEnabled();

  return {
    postPolicyDataPromise,
    getReferenceFeeNamesPromise,
    policyId,
  };
}

export async function openPremiumSection(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Premium", exact: true }).click();
  await expect(page.locator("#premium")).toBeVisible();
}

type RecalculatePayload = {
  premium?: PolicyMatrixExpectedPremium & Record<string, number>;
};

export async function waitForPremiumRecalculate(
  page: Page,
  policyId: string,
): Promise<RecalculatePayload> {
  const postPolicyDataPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`policies/${policyId}.data`) &&
      response.request().method() === "POST",
  );
  const getReferenceFeeNamesPromise = page.waitForResponse(
    "**/api/reference/fee-names.data*",
  );

  // await openPremiumSection(page);
  // await expect(page.locator("#premium")).toBeVisible();
  const [response, _] = await Promise.all([
    postPolicyDataPromise,
    getReferenceFeeNamesPromise,
  ]);
  return (await response.json()) as RecalculatePayload;
}

export function assertPremiumMatchesFixture(
  actual: PolicyMatrixExpectedPremium,
  expected: PolicyMatrixExpected,
): void {
  const tolerance = expected.premiumTolerance ?? 0.01;
  const keys = [
    "contractWorksTotalPremium",
    "liabilityTotalPremium",
    "originalTotalPremium",
    "combinedBrokerFee",
  ] as const;

  for (const key of keys) {
    const exp = expected.premium[key];
    const act = actual[key];
    if (exp == null) {
      expect(act, `${key} should be calculated`).not.toBeNull();
      expect(act).toBeGreaterThan(0);
      continue;
    }
    expect(act, key).not.toBeNull();
    expect(Math.abs((act ?? 0) - exp), key).toBeLessThanOrEqual(tolerance);
  }

  const displayExpected = expected.premiumDisplay.originalTotalPremium;
  if (displayExpected != null && actual.originalTotalPremium != null) {
    expect(formatAudCurrency(actual.originalTotalPremium)).toBe(
      displayExpected,
    );
  }
}

export async function assertPremiumUi(page: Page): Promise<void> {
  await expect(page.getByText("Total premium").first()).toBeVisible();
  await expect(page.getByText("Calculating premium")).toHaveCount(0);
}

export async function assertDocumentsFromFixture(
  page: Page,
  expected: PolicyMatrixExpected,
): Promise<void> {
  const documentsRoot = page.locator("[data-policy-documents]").first();
  await expect(documentsRoot).toBeVisible({ timeout: 90_000 });

  const heading = page.getByRole("button", {
    name: /Documents \(\d+\)/,
  });
  await expect(heading).toBeVisible();

  const label = await heading.textContent();
  const match = label?.match(/Documents \((\d+)\)/);
  const count = match ? Number(match[1]) : 0;
  expect(count).toBeGreaterThanOrEqual(expected.documents.minDocumentCount);

  for (const [field, value] of Object.entries(expected.documents.mergeFields)) {
    if (field === "CoverType") {
      await expect(
        page.getByText(value, { exact: true }).first(),
      ).toBeVisible();
      continue;
    }
    await expect(page.getByText(value).first()).toBeVisible();
  }
}

export async function markPolicyNotTaken(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Policy status$/i }).click();
  await page.getByRole("menuitem", { name: "Not taken", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: /Mark policy as Not taken/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Confirm$/i }).click();
  await expect(
    page.locator('[data-slot="badge"]', { hasText: /^Not taken$/ }),
  ).toHaveCount(2);
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

export async function assertFinalStatus(
  page: Page,
  expected: PolicyMatrixExpected,
): Promise<void> {
  if (expected.status.phase === "pending") {
    await expectPolicyPhase(page, "pending", { timeout: 90_000 });
    await expect(
      page.locator('[data-slot="badge"]', { hasText: /^Pending$/ }),
    ).toHaveCount(2);
    return;
  }

  if (expected.status.phase === "taken") {
    await expectPolicyPhase(page, "taken", { timeout: 45_000 });
    return;
  }

  await expect(
    page.locator('[data-slot="badge"]', { hasText: /^Not taken$/ }),
  ).toHaveCount(2);
}
