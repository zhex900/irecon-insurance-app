import type { FillPolicyOptions } from "../../helpers/policy-wizard";

export type PremiumBreakdownExpected = {
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

export type PremiumMatrixExpected = {
  documents: string[];
  referralReasons: string[];
  premiumBreakdown: PremiumBreakdownExpected;
  premiumBreakdownTaken?: PremiumBreakdownExpected;
};

export type PolicyMatrixScenario = {
  name: string;
  terminalState: "not-taken" | "taken";
  input: FillPolicyOptions;
  expected: PremiumMatrixExpected;
};
