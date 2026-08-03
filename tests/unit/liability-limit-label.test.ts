import { describe, expect, it } from "vitest";
import { policyToMergeInputs } from "~/lib/pdf/merge-fields";
import type { Policy } from "~/lib/db/types";

function basePolicy(liabilityLimitBand: number | string): Policy {
  return {
    policyId: 1,
    clientId: 1,
    coverTypeId: 1,
    policyCategoryId: 1,
    policyStatusId: 1,
    policyNumber: "ATCCW1",
    postcode: "2000",
    stateId: 1,
    dateStart: "2026-01-01",
    dateEnd: "2027-01-01",
    dateEffective: "2026-01-01",
    insurerCode: "ATC",
    createdBy: "test",
    createdWhen: "2026-01-01T00:00:00.000Z",
    updatedBy: "test",
    updatedWhen: "2026-01-01T00:00:00.000Z",
    documents: [],
    car: {
      coverTypeId: 1,
      annualCoverTypeId: null,
      siteAddress: "",
      insuredName: "Test",
      estimatedTurnover: 0,
      businessActivities: "",
      insuredContracts: "",
      geographicalScopes: "",
      plantEquipment: 0,
      existingStructure: 0,
      displayHomes: 0,
      claimsCountLast3Years: 0,
      anyClaimsExceed20k: false,
      declarationConfirmed: true,
      contractWorksSumInsured: 0,
      // Simulate HTML <select> value left as a string on the form snapshot.
      liabilityLimitBand: liabilityLimitBand as number,
      hasExistingContractWorksCover: false,
      currentInsurer: "",
      maximumConstructionPeriod: 0,
      maximumMaintenancePeriod: 0,
      subLimits: {},
      excesses: {},
      selectedWordingIds: [],
      customWordings: [],
      referralReasons: [],
    },
  } as Policy;
}

describe("LegalLiabilityLimit merge field", () => {
  it("prints dropdown labels for numeric and string band ids", () => {
    expect(policyToMergeInputs(basePolicy(1)).LegalLiabilityLimit).toBe(
      "$10 Million",
    );
    expect(policyToMergeInputs(basePolicy("2")).LegalLiabilityLimit).toBe(
      "$20 Million",
    );
    expect(policyToMergeInputs(basePolicy(3)).LegalLiabilityLimit).toBe(
      "Not Insured",
    );
    expect(policyToMergeInputs(basePolicy("3")).LegalLiabilityLimit).toBe(
      "Not Insured",
    );
  });
});
