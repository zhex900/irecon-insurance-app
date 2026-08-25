import { faker } from "@faker-js/faker";
import { expect, type Page, test } from "@playwright/test";

import { formatCurrency } from "~/lib/pricing/premium-utils";

import {
  type FillPolicyOptions,
  fillRequiredPolicyForm,
  openFirstClientAndStartPolicy,
  submitPolicy,
} from "./helpers/policy-wizard";

test.describe.configure({ mode: "serial" });

type PremiumMatrixExpected = {
  documents: string[];
  referralReasons: string[];
  premiumBreakdown: {
    basePremium: { contractWorks: number; legalLiability: number };
    trueBasePremium: {
      contractWorks: number;
      legalLiability: number;
      combined: number;
    };
    terrorismLevy: number;
    displayHomes: number;
    existingStructures: number;
    plantEquipment: number;
    terrorismLevyPlantEquipment: number;
    ESLPlantEquipment: number;
    ESL: { contractWorks: number; legalLiability: number; combined: number };
    GST: { contractWorks: number; legalLiability: number; combined: number };
    stampDuty: {
      contractWorks: number;
      legalLiability: number;
      combined: number;
    };
    insurerAdmin: number;
    IAAAdminFee: number;
    totalPremium: {
      contractWorks: number;
      legalLiability: number;
      combined: number;
    };
  };
};

type PremiumBreakdownExpected = PremiumMatrixExpected["premiumBreakdown"];

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

async function assertPremiumMatchesExpected(
  page: Page,
  expected: PremiumBreakdownExpected,
) {
  await page.getByText("True Base Premium").scrollIntoViewIfNeeded();

  await Promise.all(
    PREMIUM_CELL_ASSERTIONS.map(({ cellName, expected: getValue, exact }) =>
      expect(
        page.getByRole("cell", { name: cellName, exact: exact ?? false }),
      ).toHaveText(formatCurrency(getValue(expected))),
    ),
  );
}

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

async function assertPremiumSummaryAndReferralReasons(
  page: Page,
  expected: Pick<PremiumMatrixExpected, "premiumBreakdown" | "referralReasons">,
) {
  await Promise.all(
    PREMIUM_SUMMARY_ASSERTIONS.map(({ label, expected: getValue }) =>
      expect(page.getByLabel(label)).toHaveText(
        formatCurrency(getValue(expected.premiumBreakdown)),
      ),
    ),
  );

  const listItems = page
    .getByText("Referral reasons")
    .locator("..")
    .getByRole("listitem");

  await expect(listItems).toHaveText(expected.referralReasons);
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

const SECTION_STACK_SECTION_IDS = [
  "premium",
  "risk-details",
  "limits-of-liability",
  "excesses",
  "claims",
] as const;

async function assertPremiumIsLastInSectionStack(page: Page) {
  const sectionsBeforePremium = SECTION_STACK_SECTION_IDS.filter(
    (id) => id !== "premium",
  );

  await Promise.all(
    sectionsBeforePremium.map((sectionId) =>
      assertSectionAppearsBefore(page, sectionId, "premium"),
    ),
  );
}

async function assertPremiumIsFirstInSectionStack(page: Page) {
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

const scenarios: Array<{
  name: string;
  input: FillPolicyOptions;
  expected: PremiumMatrixExpected;
}> = [
  {
    name: "annual-pending",
    input: {
      insuredName: faker.company.name(),
      siteAddress: `${faker.location.streetAddress()}, ${faker.location.city()}`,
      turnover: 1_000_000,
      typeOfCover: "Annual",
      policyCategory: "New",
      annualTypeCover: "Contract Commencing",
      contractWorks: 1_500_000,
      displayHomes: 10,
      existingStructures: 30,
      plantEquipment: 40,
    },
    expected: {
      documents: [
        "ROA",
        "Schedule",
        "ATC stamp duty",
        "IA annual CAR TPL 1-2026",
        "Policy comparison 6-2024",
        "Policy highlights 2020",
      ],
      referralReasons: [
        "Display Homes has a value of $10.00",
        "Existing Structure has a value of $30.00",
        "Any claims exceeded $20,000 in value is stated as no",
        "Do not hold a current Contract Works/Liability policy",
      ],
      premiumBreakdown: {
        basePremium: {
          contractWorks: 1610,
          legalLiability: 1550,
        },
        trueBasePremium: {
          contractWorks: 1610,
          legalLiability: 1550,
          combined: 3418.41,
        },
        terrorismLevy: 257.6,
        displayHomes: 0,
        existingStructures: 0,
        plantEquipment: 0.7,
        terrorismLevyPlantEquipment: 0.11,
        ESLPlantEquipment: 0.22,
        ESL: {
          contractWorks: 504.25,
          legalLiability: 0,
          combined: 504.47,
        },
        GST: {
          contractWorks: 237.29,
          legalLiability: 155,
          combined: 392.29,
        },
        stampDuty: {
          contractWorks: 234.92,
          legalLiability: 153.45,
          combined: 388.37,
        },
        insurerAdmin: 220,
        IAAAdminFee: 88,
        totalPremium: {
          contractWorks: 2845.09,
          legalLiability: 1858.45,
          combined: 5011.54,
        },
      },
    },
  },
];

test.describe("policy matrix @policy-matrix", () => {
  test.beforeEach(async () => {
    // await mockResendEmailApi(page);
  });

  for (const scenario of scenarios) {
    test(`${scenario.name}: create → premium → documents → status`, async ({
      page,
    }) => {
      await openFirstClientAndStartPolicy(page);

      // assert new policy should have primary border
      await expect(page.getByLabel("Policy wizard header")).toHaveClass(
        /border-l-primary/,
      );

      const { newPolicyResponsePromises, policyId } =
        await fillRequiredPolicyForm(page, scenario.input);

      await Promise.all(newPolicyResponsePromises);

      await assertPremiumMatchesExpected(
        page,
        scenario.expected.premiumBreakdown,
      );

      await assertPremiumSummaryAndReferralReasons(page, scenario.expected);

      await assertPremiumIsLastInSectionStack(page);

      await submitPolicy(page, {
        policyId,
        expectedDocuments: scenario.expected.documents,
      });

      const wizardRoot = page.locator("[data-policy-phase]");
      await expect(wizardRoot).toHaveAttribute("data-policy-phase", "pending");

      await expect(page.getByLabel("Policy wizard header")).toHaveClass(
        /border-l-warning/,
      );

      await assertPremiumIsFirstInSectionStack(page);
    });
  }
});
