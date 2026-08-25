import {
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";

function wizardRoot(page: Page): Locator {
  return page.locator("[data-policy-phase]");
}

async function expectPolicyPhase(
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

type FillPolicyOptionsCommon = {
  insuredName: string;
  siteAddress: string;
  turnover: number;
  existingStructurePremium: number;
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

export async function dismissBlockedTakenDialog(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", {
    name: "Cannot mark as Taken",
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Review highlighted fields" })
    .click();
  await expect(dialog).toBeHidden();
}

export async function markPolicyNotTaken(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Policy status$/i }).click();
  await page.getByRole("menuitem", { name: "Not taken", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: /Mark policy as Not taken/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Confirm$/i }).click();
}
