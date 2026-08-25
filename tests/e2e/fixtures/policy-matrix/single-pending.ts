import type { PolicyMatrixExpected, PolicyMatrixInput } from "./types";

export const singlePendingInput = {
  scenarioId: "single-pending",
  coverTypeId: 2,
  coverTypeName: "Single",
  annualCoverTypeId: null,
  annualCoverTypeName: null,
  finalStatus: "pending",
  client: { pick: "first-seeded" },
  form: {
    insuredName: "E2E Matrix Single Pending Pty Ltd",
    siteAddress: "100 Matrix Street, Sydney NSW 2000",
    postcode: "2000",
    state: "NSW",
    estimatedTurnover: 1_000_000,
    contractWorksSumInsured: 1_500_000,
    displayHomes: 0,
    existingStructure: 0,
    plantEquipment: 50_000,
    liabilityLimitBand: "$10 Million",
    hasExistingContractWorksCover: "No",
    claimsCountLast3Years: 0,
    anyClaimsExceed20k: "No",
    declarationConfirmed: true,
    unsealedRoadworksConfirmed: true,
  },
  dates: {
    dateStart: "2026-01-01",
    dateEnd: "2026-12-31",
  },
} satisfies PolicyMatrixInput;

export const singlePendingExpected = {
  scenarioId: "single-pending",
  status: {
    policyStatusId: 1,
    phase: "pending",
    badgeText: "Pending",
  },
  premium: {
    contractWorksTotalPremium: null,
    liabilityTotalPremium: null,
    originalTotalPremium: null,
    combinedBrokerFee: null,
  },
  premiumDisplay: {
    originalTotalPremium: null,
  },
  premiumTolerance: 0.01,
  documents: {
    packTemplateKeys: [],
    minDocumentCount: 1,
    mergeFields: {
      CoverType: "Single",
      InsuredName: "E2E Matrix Single Pending Pty Ltd",
      SiteAddress: "100 Matrix Street, Sydney NSW 2000",
      LegalLiabilityLimit: "$10 Million",
    },
  },
} satisfies PolicyMatrixExpected;
