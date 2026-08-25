import { faker } from "@faker-js/faker";

import type { FillPolicyOptions } from "../../helpers/policy-wizard";
import type { PremiumBreakdownExpected } from "./types";

export const annualDocuments = [
  "ROA",
  "Schedule",
  "ATC stamp duty",
  "IA annual CAR TPL 1-2026",
  "Policy comparison 6-2024",
  "Policy highlights 2020",
] as const;

export const annualReferralReasons = [
  "Display Homes has a value of $10.00",
  "Existing Structure has a value of $30.00",
  "Any claims exceeded $20,000 in value is stated as no",
  "Do not hold a current Contract Works/Liability policy",
] as const;

export const annualPremiumBreakdown = {
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
} satisfies PremiumBreakdownExpected;

export const annualPremiumBreakdownTaken = {
  basePremium: {
    contractWorks: 1610,
    legalLiability: 1550,
  },
  trueBasePremium: {
    contractWorks: 1610,
    legalLiability: 1550,
    combined: 3534.41,
  },
  terrorismLevy: 273.6,
  displayHomes: 0,
  existingStructures: 100,
  plantEquipment: 0.7,
  terrorismLevyPlantEquipment: 0.11,
  ESLPlantEquipment: 0.22,
  ESL: {
    contractWorks: 535.57,
    legalLiability: 0,
    combined: 535.79,
  },
  GST: {
    contractWorks: 252.02,
    legalLiability: 155,
    combined: 407.02,
  },
  stampDuty: {
    contractWorks: 249.5,
    legalLiability: 153.45,
    combined: 402.95,
  },
  insurerAdmin: 220,
  IAAAdminFee: 88,
  totalPremium: {
    contractWorks: 3021.72,
    legalLiability: 1858.45,
    combined: 5188.17,
  },
} satisfies PremiumBreakdownExpected;

export function createAnnualMatrixInput(): FillPolicyOptions {
  return {
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
    existingStructurePremium: 100,
  };
}
