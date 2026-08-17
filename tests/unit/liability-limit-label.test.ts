import { describe, expect, it } from "vitest";

import type { Policy } from "~/lib/db/types";
import { policyToMergeInputs } from "~/lib/pdf/merge-fields";

function basePolicy(opts: {
  liabilityLimitBand?: number | string;
  coverTypeId?: number | string;
}): Policy {
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
      // Simulate HTML <select> value left as a string on the form snapshot.
      coverTypeId: (opts.coverTypeId ?? 1) as number,
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
      liabilityLimitBand: (opts.liabilityLimitBand ?? 1) as number,
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
    expect(
      policyToMergeInputs(basePolicy({ liabilityLimitBand: 1 }))
        .LegalLiabilityLimit,
    ).toBe("$10 Million");
    expect(
      policyToMergeInputs(basePolicy({ liabilityLimitBand: "2" }))
        .LegalLiabilityLimit,
    ).toBe("$20 Million");
    expect(
      policyToMergeInputs(basePolicy({ liabilityLimitBand: 3 }))
        .LegalLiabilityLimit,
    ).toBe("Not Insured");
    expect(
      policyToMergeInputs(basePolicy({ liabilityLimitBand: "3" }))
        .LegalLiabilityLimit,
    ).toBe("Not Insured");
  });
});

describe("CoverType merge field", () => {
  it("prints cover labels for numeric and string cover type ids", () => {
    expect(policyToMergeInputs(basePolicy({ coverTypeId: 1 })).CoverType).toBe(
      "Annual",
    );
    expect(
      policyToMergeInputs(basePolicy({ coverTypeId: "2" })).CoverType,
    ).toBe("Single");
    expect(policyToMergeInputs(basePolicy({ coverTypeId: 2 })).CoverType).toBe(
      "Single",
    );
    expect(
      policyToMergeInputs(basePolicy({ coverTypeId: "3" })).CoverTypeUpper,
    ).toBe("OWNER BUILDER");
  });
});
