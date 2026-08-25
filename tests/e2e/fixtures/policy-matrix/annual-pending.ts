import type { PolicyMatrixExpected, PolicyMatrixInput } from "./types";

export const annualPendingInput = {
  scenarioId: "annual-pending",
  coverTypeId: 1,
  coverTypeName: "Annual",
  annualCoverTypeId: 2,
  annualCoverTypeName: "Contract Commencing",
  finalStatus: "pending",
  client: { pick: "first-seeded" },
  form: {
    insuredName: "E2E Matrix Annual Pending Pty Ltd",
    siteAddress: "200 Matrix Avenue, Sydney NSW 2000",
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
    dateEnd: "2027-06-30",
  },
} satisfies PolicyMatrixInput;

export const annualPendingExpected = {
  scenarioId: "annual-pending",
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
      CoverType: "Annual",
      InsuredName: "E2E Matrix Annual Pending Pty Ltd",
      SiteAddress: "200 Matrix Avenue, Sydney NSW 2000",
      LegalLiabilityLimit: "$10 Million",
    },
  },
} satisfies PolicyMatrixExpected;
