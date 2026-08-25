import {
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";

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
  const referenceListResponsePromise = page.waitForResponse(
    "**/api/reference/list.data**",
  );
  await page.goto("/clients");
  await expect(
    page.getByRole("heading", { name: /clients directory/i }),
  ).toBeVisible();
  await referenceListResponsePromise;
  const clientRow = page.getByRole("row", { name: /^open client/i }).first();
  await expect(clientRow).toBeVisible();

  const navigationPromise = page.waitForURL(/\/clients\/[^/]+$/);
  const recentRoutesPromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/recent-routes") &&
      response.request().method() === "POST",
  );

  // Click name column — avoids the delete button in the actions cell.
  await clientRow.click();

  await navigationPromise;
  await recentRoutesPromise;
  await expect(page).toHaveURL(/\/clients\/[^/]+$/);
  const newPolicyPromise = page.waitForResponse(
    (response) =>
      response.url().includes("policies/new.data?clientId=") &&
      response.request().method() === "POST",
  );
  const newPolicyButton = page.getByRole("button", { name: /new policy/i });
  await expect(newPolicyButton.first()).toBeVisible();
  await newPolicyButton.first().click();
  await newPolicyPromise;
  await expect(page).toHaveURL(/\/policies\/[^/]+$/);
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

type FillPolicyOptionsCommon = {
  insuredName: string;
  siteAddress: string;
  turnover: number;
  contractWorks: number;
  displayHomes: number;
  existingStructures: number;
  policyCategory: "New" | "Renewal";
  plantEquipment: number;
  limitOfLiability?: "$10 Million" | "$20 Million" | "Not Insured";
  state?: "NSW" | "VIC" | "QLD" | "SA" | "TAS" | "NT";
  postcode?: string;
};

export type FillPolicyOptions =
  | (FillPolicyOptionsCommon & {
      typeOfCover: "Annual";
      annualTypeCover: "Contract Commencing" | "Contract Ending";
    })
  | (FillPolicyOptionsCommon & {
      typeOfCover: "Single" | "Owner Builder";
    });

/** Fill required CAR wizard fields for a Single / New policy. */
export async function fillRequiredPolicyForm(
  page: Page,
  options: FillPolicyOptions,
): Promise<{
  newPolicyResponsePromises: Promise<Response>[];
  policyId: string;
}> {
  const {
    insuredName,
    siteAddress,
    postcode = "2000",
    state = "NSW",
    turnover,
    contractWorks,
    displayHomes,
    existingStructures,
    plantEquipment,
    policyCategory = "New",
    limitOfLiability = "$10 Million",
  } = options;

  await page.getByRole("textbox", { name: "Insured Name" }).fill(insuredName);

  await page
    .getByRole("combobox", { name: "Type of Cover", exact: true })
    .click();
  await page.getByRole("option", { name: options.typeOfCover }).click();

  if (options.typeOfCover === "Annual") {
    await page.getByRole("combobox", { name: "Annual Type of Cover" }).click();
    await page.getByRole("option", { name: options.annualTypeCover }).click();
  }

  await page.getByRole("combobox", { name: "Policy Category" }).click();
  await page.getByRole("option", { name: policyCategory, exact: true }).click();

  await page.getByRole("textbox", { name: "Site Address" }).fill(siteAddress);
  await page.getByRole("textbox", { name: "Postcode" }).fill(postcode);
  await page.getByRole("combobox", { name: "State" }).click();
  await page.getByRole("option", { name: state }).click();
  await page
    .getByRole("textbox", { name: "Estimated Turnover / Project" })
    .fill(turnover.toString());

  await page.getByRole("combobox", { name: "Do you hold a current" }).click();
  await page.getByRole("option", { name: "No" }).click();
  await page
    .getByRole("textbox", { name: "Contract Works" })
    .fill(contractWorks.toString());
  await page
    .getByRole("textbox", { name: "Display Homes" })
    .fill(displayHomes.toString());
  await page
    .getByRole("textbox", { name: "Existing Structures" })
    .fill(existingStructures.toString());

  await page
    .locator('input[name="plantEquipment"]')
    .fill(plantEquipment.toString());

  await page.getByRole("combobox", { name: "Limit of Liability" }).click();
  await page.getByRole("option", { name: limitOfLiability }).click();
  await page
    .getByRole("combobox", { name: /Have any claims exceeded \$20/i })
    .click();
  await page
    .getByRole("listbox")
    .getByRole("option", { name: "No", exact: true })
    .click();
  const policyId = page.url().split("/").pop()?.split("?")[0];
  if (!policyId) {
    throw new Error(`Expected policy id in URL, got ${page.url()}`);
  }

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
  return {
    newPolicyResponsePromises: [
      postPolicyDataPromise,
      getReferenceFeeNamesPromise,
    ],
    policyId,
  };
}

export async function submitPolicy(
  page: Page,
  {
    policyId,
    expectedDocuments,
  }: { policyId: string; expectedDocuments: string[] },
): Promise<void> {
  await page
    .getByRole("button", { name: "Submit" })
    .first()
    .click({ force: true });

  const submitDialog = page.getByRole("dialog", { name: "Submit policy?" });

  // 1. Verify dialog & heading are visible
  await expect(submitDialog).toBeVisible();
  await expect(
    submitDialog.getByRole("heading", { level: 2, name: "Submit policy?" }),
  ).toBeVisible();

  // 2. Assert list items inside the dialog
  await expect(submitDialog.getByRole("listitem")).toHaveText(
    expectedDocuments,
  );
  const submitPolicyPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/policies/${policyId}`) &&
      response.request().method() === "POST",
  );
  const submitPolicyDataPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/policies/${policyId}.data`) &&
      response.request().method() === "POST",
  );
  const submitPolicyNotePromise = page.waitForResponse("**reference.fee-names");

  await page.getByRole("button", { name: "Confirm & generate" }).click();

  await Promise.all([
    submitPolicyPromise,
    submitPolicyDataPromise,
    submitPolicyNotePromise,
  ]);
  await expect(submitDialog).toBeHidden();
}

export async function markPolicyTaken(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Policy status$/i }).click();
  await page.getByRole("menuitem", { name: /^Taken$/i }).click();
  await expect(
    page.getByRole("dialog", { name: /Mark policy as Taken\?/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Confirm$/i }).click();
  await expectPolicyPhase(page, "taken");
}
export async function markPolicyNotTaken(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Policy status$/i }).click();
  await page.getByRole("menuitem", { name: "Not taken", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: /Mark policy as Not taken/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Confirm$/i }).click();
}
