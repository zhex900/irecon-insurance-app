import { expect, type Page } from "@playwright/test";

import { formatCurrency } from "~/lib/pricing/premium-utils";

import type { PremiumBreakdownExpected } from "../scenarios/policy-matrix/types";
import {
  dismissBlockedTakenDialog,
  markPolicyNotTaken,
  policyIdFromUrl,
  waitForPolicyRouteSave,
  waitForPremiumCalculationIdle,
} from "./policy-wizard";

type PremiumCellAssertion = {
  cellName: string;
  expected: (values: PremiumBreakdownExpected) => number;
  exact?: boolean;
};

const PREMIUM_CELL_ASSERTIONS: PremiumCellAssertion[] = [
  {
    cellName: "contractWorksCalculatedBasePremium",
    expected: (e) => e.basePremium.contractWorks,
  },
  {
    cellName: "liabilityCalculatedBasePremium",
    expected: (e) => e.basePremium.legalLiability,
  },
  {
    cellName: "contractWorksBasePremium",
    expected: (e) => e.trueBasePremium.contractWorks,
  },
  {
    cellName: "liabilityBasePremium",
    expected: (e) => e.trueBasePremium.legalLiability,
  },
  {
    cellName: "true base premium combined",
    expected: (e) => e.trueBasePremium.combined,
  },
  {
    cellName: "contractWorksTerrorismPremium",
    expected: (e) => e.terrorismLevy,
  },
  {
    cellName: "contractWorksDisplayHomesPremium",
    expected: (e) => e.displayHomes,
  },
  {
    cellName: "contractWorksExistingStructurePremium",
    expected: (e) => e.existingStructures,
  },
  {
    cellName: "contractWorksPlantPremium",
    expected: (e) => e.plantEquipment,
  },
  {
    cellName: "contractWorksPlantTerrorismPremium",
    expected: (e) => e.terrorismLevyPlantEquipment,
  },
  {
    cellName: "contractWorksPlantESL",
    expected: (e) => e.ESLPlantEquipment,
  },
  { cellName: "contractWorksESL", expected: (e) => e.ESL.contractWorks },
  { cellName: "liabilityESL", expected: (e) => e.ESL.legalLiability },
  { cellName: "esl combined", expected: (e) => e.ESL.combined },
  { cellName: "contractWorksGST", expected: (e) => e.GST.contractWorks },
  { cellName: "liabilityGST", expected: (e) => e.GST.legalLiability },
  { cellName: "gst combined", expected: (e) => e.GST.combined },
  {
    cellName: "contractWorksStampDuty",
    expected: (e) => e.stampDuty.contractWorks,
  },
  {
    cellName: "liabilityStampDuty",
    expected: (e) => e.stampDuty.legalLiability,
  },
  { cellName: "stamp duty combined", expected: (e) => e.stampDuty.combined },
  {
    cellName: "Insurer Admin (includes GST)",
    expected: (e) => e.insurerAdmin,
    exact: true,
  },
  {
    cellName: "IAA Admin Fee (includes GST)",
    expected: (e) => e.IAAAdminFee,
    exact: true,
  },
  {
    cellName: "total premium contract works",
    expected: (e) => e.totalPremium.contractWorks,
  },
  {
    cellName: "total premium legal liability",
    expected: (e) => e.totalPremium.legalLiability,
  },
  {
    cellName: "total premium combined",
    expected: (e) => e.totalPremium.combined,
  },
];

type PremiumSummaryAssertion = {
  label: string;
  expected: (values: PremiumBreakdownExpected) => number;
};

const PREMIUM_SUMMARY_ASSERTIONS: PremiumSummaryAssertion[] = [
  {
    label: "premium summary Contract works total",
    expected: (e) => e.totalPremium.contractWorks,
  },
  {
    label: "premium summary Legal liability total",
    expected: (e) => e.totalPremium.legalLiability,
  },
  {
    label: "premium summary Total premium",
    expected: (e) => e.totalPremium.combined,
  },
];

const SECTION_STACK_SECTION_IDS = [
  "premium",
  "risk-details",
  "limits-of-liability",
  "excesses",
  "claims",
] as const;

async function assertPremiumMatchesExpected(
  page: Page,
  expected: PremiumBreakdownExpected,
) {
  await expect(page.locator("#premium")).toBeVisible();
  await page.locator("#premium").scrollIntoViewIfNeeded();

  await Promise.all(
    PREMIUM_CELL_ASSERTIONS.map(({ cellName, expected: getValue, exact }) =>
      expect(
        page.getByRole("cell", { name: cellName, exact: exact ?? false }),
      ).toHaveText(formatCurrency(getValue(expected))),
    ),
  );
}

async function assertPremiumSummaryAndReferralReasons(
  page: Page,
  premiumBreakdown: PremiumBreakdownExpected,
  referralReasons: string[],
) {
  await Promise.all(
    PREMIUM_SUMMARY_ASSERTIONS.map(({ label, expected: getValue }) =>
      expect(page.getByLabel(label)).toHaveText(
        formatCurrency(getValue(premiumBreakdown)),
      ),
    ),
  );

  const listItems = page
    .getByText("Referral reasons")
    .locator("..")
    .getByRole("listitem");

  await expect(listItems).toHaveText(referralReasons);
}

export async function assertPremiumExpectations(
  page: Page,
  premiumBreakdown: PremiumBreakdownExpected,
  referralReasons: string[],
) {
  await assertPremiumMatchesExpected(page, premiumBreakdown);
  await assertPremiumSummaryAndReferralReasons(
    page,
    premiumBreakdown,
    referralReasons,
  );
}

async function assertSectionAppearsBefore(
  page: Page,
  beforeSectionId: string,
  afterSectionId: string,
) {
  await expect(page.locator(`#${beforeSectionId}`)).toBeVisible();
  await expect(page.locator(`#${afterSectionId}`)).toBeVisible();

  const beforePrecedesAfter = await page.evaluate(
    ([beforeId, afterId]) => {
      const beforeEl = document.getElementById(beforeId);
      const afterEl = document.getElementById(afterId);
      if (!beforeEl || !afterEl) return false;

      return Boolean(
        afterEl.compareDocumentPosition(beforeEl) &
        Node.DOCUMENT_POSITION_PRECEDING,
      );
    },
    [beforeSectionId, afterSectionId] as const,
  );

  expect(beforePrecedesAfter).toBe(true);
}

export async function assertPremiumIsLastInSectionStack(page: Page) {
  const sectionsBeforePremium = SECTION_STACK_SECTION_IDS.filter(
    (id) => id !== "premium",
  );

  await Promise.all(
    sectionsBeforePremium.map((sectionId) =>
      assertSectionAppearsBefore(page, sectionId, "premium"),
    ),
  );
}

export async function assertPremiumIsFirstInSectionStack(page: Page) {
  const sectionStack = page.getByLabel("Policy wizard section stack");
  await expect(sectionStack).toBeVisible();

  const firstSectionId = await sectionStack.evaluate((stack, sectionIds) => {
    let first: HTMLElement | null = null;

    for (const id of sectionIds) {
      const el = stack.querySelector<HTMLElement>(`#${id}`);
      if (!el) continue;

      if (
        !first ||
        Boolean(
          el.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
        )
      ) {
        first = el;
      }
    }

    return first?.id ?? null;
  }, SECTION_STACK_SECTION_IDS);

  expect(firstSectionId).toBe("premium");
}

async function assertPolicyNotTaken(page: Page) {
  const wizardRoot = page.locator("[data-policy-phase]");
  const header = page.getByLabel("Policy wizard header");

  await expect(wizardRoot).toHaveAttribute("data-policy-phase", "not-taken");
  await expect(header.getByLabel("policy status badge")).toHaveText(
    "Not taken",
  );
  await expect(header).toHaveClass(/border-l-muted-foreground\/40/);
}

async function assertPolicyTaken(page: Page) {
  const header = page.getByLabel("Policy wizard header");

  await expect(header).toHaveClass(/border-l-success/);
  await expect(header.getByLabel("policy status badge")).toHaveText("Taken");
}

async function assertBlockedTakenDialog(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: "Cannot mark as Taken",
  });

  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      level: 2,
      name: "Cannot mark as Taken",
    }),
  ).toBeVisible();

  const errorItem = dialog.getByRole("listitem");
  await expect(errorItem).toContainText("Existing Structure premium");
  await expect(errorItem).toContainText(
    "Existing Structures is declared on Limits",
  );
}

async function assertExistingStructureHighlighted(page: Page) {
  await expect(
    page.getByText("Existing Structure", { exact: true }),
  ).toHaveClass(/text-warning/);
}

async function setExistingStructurePremium(page: Page, amount: number) {
  await page
    .getByLabel("contractWorksExistingStructurePremium")
    .getByRole("button", { name: "$" })
    .click();
  await page
    .getByRole("textbox", { name: "Edit premium value" })
    .fill(String(amount));
  await page.keyboard.press("Enter");
  await waitForPremiumCalculationIdle(page);
}

async function confirmMarkPolicyTaken(page: Page) {
  await page.getByRole("button", { name: /^Policy status$/i }).click();
  await page.getByRole("menuitem", { name: /^Taken$/i }).click();

  const dialog = page.getByRole("dialog", { name: "Mark policy as Taken?" });
  await expect(dialog).toBeVisible();
  const policyId = policyIdFromUrl(page);
  const confirmMarkPolicyTakenPromise = waitForPolicyRouteSave(page, policyId);
  await page.getByRole("button", { name: /^Confirm$/i }).click();
  // Taken confirm may regenerate documents (slow on preview) before the save POST.
  // Prefer the terminal UI outcome over waiting on every network hop.
  await Promise.race([confirmMarkPolicyTakenPromise, assertPolicyTaken(page)]);
  await expect(dialog).not.toBeVisible();
  await assertPolicyTaken(page);
}

export async function completeTakenTerminalFlow(
  page: Page,
  {
    premiumBreakdownTaken,
    referralReasons,
  }: {
    premiumBreakdownTaken: PremiumBreakdownExpected;
    referralReasons: string[];
  },
) {
  await page.getByRole("button", { name: /^Policy status$/i }).click();
  await page.getByRole("menuitem", { name: /^Taken$/i }).click();

  await assertBlockedTakenDialog(page);
  await dismissBlockedTakenDialog(page);
  await assertExistingStructureHighlighted(page);
  await setExistingStructurePremium(page, 100);
  await assertPremiumExpectations(page, premiumBreakdownTaken, referralReasons);

  await confirmMarkPolicyTaken(page);
  await assertPolicyTaken(page);

  const libraryDocumentsPromise = page.waitForResponse(
    "**/api/library-documents",
  );
  const policeId = policyIdFromUrl(page);
  const noteAuthorPromise = page.waitForResponse(
    `**/api/policies/${policeId}/note-authors`,
  );

  await page.reload();

  await Promise.all([libraryDocumentsPromise, noteAuthorPromise]);
  await page.waitForURL(`/policies/${policeId}`);

  await assertPremiumExpectations(page, premiumBreakdownTaken, referralReasons);
  await assertPolicyTaken(page);
}

export async function completeNotTakenTerminalFlow(
  page: Page,
  premiumBreakdown: PremiumBreakdownExpected,
  referralReasons: string[],
) {
  await markPolicyNotTaken(page);
  await assertPolicyNotTaken(page);
  const libraryDocumentsPromise = page.waitForResponse(
    "**/api/library-documents",
  );
  const policeId = policyIdFromUrl(page);
  const noteAuthorPromise = page.waitForResponse(
    `**/api/policies/${policeId}/note-authors`,
  );
  await page.reload();
  await Promise.all([libraryDocumentsPromise, noteAuthorPromise]);
  await page.waitForURL(`/policies/${policeId}`);
  await assertPolicyNotTaken(page);
  await assertPremiumExpectations(page, premiumBreakdown, referralReasons);
}
