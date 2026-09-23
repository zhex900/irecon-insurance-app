import { describe, expect, it } from "vitest";

import { policyToFormValues } from "~/components/policies/wizard/shared/policy-to-values";
import type { Policy } from "~/lib/db/types";
import { money } from "~/lib/pdf/merge-field-tables";
import {
  normalizePdfmeTemplateSchemas,
  policyToMergeInputs,
} from "~/lib/pdf/merge-fields";

function basePolicy(opts: {
  liabilityLimitBand?: number | string;
  coverTypeId?: number | string;
}): Policy {
  return {
    policyId: "1",
    clientId: "1",
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
      contractWorksExistingStructurePremium: 0,
      contractWorksDisplayHomesPremium: 0,
      subLimits: {
        removalOfDebris: "",
        expeditingExpenses: "",
        professionalFees: "",
        mitigationExpenses: "",
        searchAndLocateCosts: "",
        plantHireCharges: "",
        claimsPreparationCosts: "",
        governmentCosts: "",
        inflationProtection: "",
        employeesProperty: "",
        materialsInOffSiteStorage: "",
        transit: "",
      },
      excesses: {
        excessPlantEquipment: "",
        excessUpTo2MMinorPerils: "",
        excessUpTo2MMajorPerils: "",
        excessOver2MMinorPerils: "",
        excessOver2MMajorPerils: "",
        excessAdditionalNotes: "",
        excessWorkerToWorker: "",
        excessUpTo2MLimit10M: "",
        excessUpTo2MLimit20M: "",
        excessOver2MLimit10M: "",
        excessOver2MLimit20M: "",
      },
      excludedContracts1: "",
      excludedContracts2: "",
      excludedContracts3: "",
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

describe("insured name defaults", () => {
  it("uses the client name only when the policy insured name is empty", () => {
    const policy = basePolicy({});
    policy.car.insuredName = "";

    expect(policyToFormValues(policy, "Trading Name").insuredName).toBe(
      "Trading Name",
    );

    policy.car.insuredName = "Existing Insured Name";
    expect(policyToFormValues(policy, "Trading Name").insuredName).toBe(
      "Existing Insured Name",
    );
  });
});

describe("excess merge fields", () => {
  it("prints N/A for missing monetary document values", () => {
    expect(money(undefined)).toBe("N/A");
    expect(money(null)).toBe("N/A");
    expect(money("")).toBe("N/A");
    expect(money("   ")).toBe("N/A");
    expect(money("n/a")).toBe("N/A");
    expect(money("Not Insured")).toBe("Not Insured");
    expect(money(2500)).toBe("$2,500.00");
  });

  it("maps ROA and schedule excess values to the selected contract band", () => {
    const policy = basePolicy({ liabilityLimitBand: 2 });
    policy.car.estimatedTurnover = 1_000_000;
    policy.car.contractWorksSumInsured = 1_000_000;
    policy.car.plantEquipment = 125_000;
    policy.car.excesses = {
      excessPlantEquipment: "1100",
      excessUpTo2MMinorPerils: "2200",
      excessUpTo2MMajorPerils: "3300",
      excessOver2MMinorPerils: "4400",
      excessOver2MMajorPerils: "5500",
      excessWorkerToWorker: "6600",
      excessUpTo2MLimit10M: "7700",
      excessUpTo2MLimit20M: "8800",
      excessOver2MLimit10M: "9900",
      excessOver2MLimit20M: "10100",
      excessAdditionalNotes: "",
    };

    const upTo2m = policyToMergeInputs(policy);
    expect(upTo2m.ExcessPlantEquipment).toBe("$1,100.00");
    expect(upTo2m.ExcessMinorPerils).toBe("$4,400.00");
    expect(upTo2m.ExcessMajorPerils).toBe("$5,500.00");
    expect(upTo2m.ExcessWorkerToWorker).toBe("$6,600.00");
    expect(upTo2m.ExcessLimit10M).toBe("N/A");
    expect(upTo2m.ExcessLimit20M).toBe("$8,800.00");

    policy.car.estimatedTurnover = 3_000_000;
    policy.car.contractWorksSumInsured = 3_000_000;
    const over2m = policyToMergeInputs(policy);
    expect(over2m.ExcessMinorPerils).toBe("$4,400.00");
    expect(over2m.ExcessMajorPerils).toBe("$5,500.00");
    expect(over2m.ExcessLimit10M).toBe("N/A");
    expect(over2m.ExcessLimit20M).toBe("$10,100.00");
  });

  it("prints N/A for missing active-band perils and $20M excess values", () => {
    const policy = basePolicy({ liabilityLimitBand: 2 });
    policy.car.estimatedTurnover = 3_000_000;
    policy.car.contractWorksSumInsured = 3_000_000;

    const inputs = policyToMergeInputs(policy);
    expect(inputs.ExcessMinorPerils).toBe("N/A");
    expect(inputs.ExcessMajorPerils).toBe("N/A");
    expect(inputs.ExcessLimit20M).toBe("N/A");
  });

  it("repairs the legacy ROA worker-to-worker field binding", () => {
    const normalized = normalizePdfmeTemplateSchemas({
      schemas: [
        [
          {
            name: "worker-label",
            type: "text",
            content: "Worker to Worker Claims",
            position: { x: 55, y: 236.67 },
          },
          {
            name: "ExcessUpTo2MLimit20M copy copy",
            type: "text",
            content: "{ExcessUpTo2MLimit20M}",
            position: { x: 127, y: 236.67 },
          },
        ],
      ],
    });

    expect(normalized.schemas[0]?.[1]).toMatchObject({
      name: "ExcessWorkerToWorker",
      content: "{ExcessWorkerToWorker}",
    });
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
