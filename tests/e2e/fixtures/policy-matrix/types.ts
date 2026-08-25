export type PolicyMatrixFormInput = {
  insuredName: string;
  siteAddress: string;
  postcode: string;
  state: string;
  estimatedTurnover: number;
  contractWorksSumInsured: number;
  displayHomes: number;
  existingStructure: number;
  plantEquipment: number;
  liabilityLimitBand: string;
  hasExistingContractWorksCover: string;
  claimsCountLast3Years: number;
  anyClaimsExceed20k: string;
  declarationConfirmed: boolean;
  unsealedRoadworksConfirmed: boolean;
};

export type PolicyMatrixFinalStatus = "pending" | "taken" | "not_taken";

export type PolicyMatrixInput = {
  scenarioId: string;
  coverTypeId: number;
  coverTypeName: string;
  annualCoverTypeId: number | null;
  annualCoverTypeName: string | null;
  finalStatus: PolicyMatrixFinalStatus;
  client: { pick: string };
  form: PolicyMatrixFormInput;
  dates: {
    dateStart: string;
    dateEnd: string;
  };
};

export type PolicyMatrixExpectedPremium = {
  contractWorksTotalPremium: number | null;
  liabilityTotalPremium: number | null;
  originalTotalPremium: number | null;
  combinedBrokerFee: number | null;
};

export type PolicyMatrixExpected = {
  scenarioId: string;
  status: {
    policyStatusId: number;
    phase: string;
    badgeText: string;
  };
  premium: PolicyMatrixExpectedPremium;
  premiumDisplay: {
    originalTotalPremium: string | null;
  };
  premiumTolerance: number;
  documents: {
    packTemplateKeys: string[];
    minDocumentCount: number;
    mergeFields: Record<string, string>;
  };
};

export type PolicyMatrixScenarioMeta = {
  id: string;
  coverTypeId: number;
  coverTypeName: string;
  finalStatus: PolicyMatrixFinalStatus;
  priority: "P0" | "P1" | "P2";
};

export type PolicyMatrixFixture = {
  input: PolicyMatrixInput;
  expected: PolicyMatrixExpected;
};
