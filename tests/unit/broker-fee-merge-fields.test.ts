import { describe, expect, it } from "vitest";

import type { Policy } from "~/lib/db/types";
import {
  alignBrokerFeeSchemaNames,
  brokerFeeMergeFields,
  policyToMergeInputs,
} from "~/lib/pdf/merge-fields";

const FEE_LINES = [
  {
    name: "Insurer Admin (includes GST)",
    sortOrder: 1,
    fee: 200,
    feeGst: 20,
  },
  {
    name: "IAA Admin Fee (includes GST)",
    sortOrder: 2,
    fee: 80,
    feeGst: 8,
  },
];

function policyWithPremium(): Policy {
  return {
    policyId: 1027,
    clientId: 1,
    coverTypeId: 1,
    policyCategoryId: 1,
    policyStatusId: 1,
    policyNumber: "ATCCW1027",
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
      liabilityLimitBand: 1,
      hasExistingContractWorksCover: false,
      currentInsurer: "",
      maximumConstructionPeriod: 0,
      maximumMaintenancePeriod: 0,
      subLimits: {},
      excesses: {},
      selectedWordingIds: [],
      customWordings: [],
      referralReasons: [],
      premium: {
        contractWorksCalculatedBasePremium: 0,
        contractWorksBasePremium: 0,
        contractWorksPlantPremium: 0,
        contractWorksPlantESL: 0,
        contractWorksESL: 0,
        contractWorksGST: 0,
        contractWorksStampDuty: 0,
        contractWorksTerrorismPremium: 0,
        contractWorksPlantTerrorismPremium: 0,
        contractWorksDisplayHomesPremium: 0,
        contractWorksExistingStructurePremium: 0,
        contractWorksTotalPremium: 0,
        liabilityCalculatedBasePremium: 0,
        liabilityBasePremium: 0,
        liabilityESL: 0,
        liabilityGST: 0,
        liabilityStampDuty: 0,
        liabilityTotalPremium: 0,
        combinedBrokerFee: 308,
        originalTotalPremium: 308,
      },
    },
  } as Policy;
}

describe("brokerFeeMergeFields", () => {
  it("maps schedule lines to legacy rating fee fields (ex GST + GST total)", () => {
    expect(brokerFeeMergeFields(FEE_LINES)).toEqual({
      InsurerAdminFee: "$200.00",
      IAAAdminFee: "$80.00",
      BrokerFeeGst: "$28.00",
    });
  });
});

describe("policyToMergeInputs broker fees", () => {
  it("does not invent GST as 10% of combined broker fee", () => {
    const inputs = policyToMergeInputs(policyWithPremium());
    expect(inputs.BrokerFee).toBe("$308.00");
    expect(inputs.BrokerFeeGst).toBeUndefined();
    expect(inputs.InsurerAdminFee).toBeUndefined();
  });

  it("fills named fee fields when schedule lines are provided", () => {
    const inputs = policyToMergeInputs(policyWithPremium(), {
      brokerFeeLines: FEE_LINES,
    });
    expect(inputs.BrokerFee).toBe("$308.00");
    expect(inputs.InsurerAdminFee).toBe("$200.00");
    expect(inputs.IAAAdminFee).toBe("$80.00");
    expect(inputs.BrokerFeeGst).toBe("$28.00");
  });
});

describe("alignBrokerFeeSchemaNames", () => {
  it("rebinds swapped fee value fields to their labels by Y", () => {
    const page = [
      {
        name: "_Label_InsurerAdminFee",
        type: "text",
        content: "Insurer Admin:",
        position: { x: 0, y: 107 },
      },
      {
        name: "BrokerFeeGst",
        type: "text",
        content: "{BrokerFeeGst}",
        position: { x: 150, y: 107 },
      },
      {
        name: "_Label_IAAAdminFee",
        type: "text",
        content: "IAA Admin Fee:",
        position: { x: 0, y: 113 },
      },
      {
        name: "IAAAdminFee",
        type: "text",
        content: "{IAAAdminFee}",
        position: { x: 150, y: 113 },
      },
      {
        name: "_Label_22",
        type: "text",
        content: "Total Fee GST:",
        position: { x: 0, y: 119 },
      },
      {
        name: "InsurerAdminFee",
        type: "text",
        content: "{InsurerAdminFee}",
        position: { x: 150, y: 119 },
      },
    ];

    const aligned = alignBrokerFeeSchemaNames(page);
    expect(aligned[1]).toMatchObject({
      name: "InsurerAdminFee",
      content: "{InsurerAdminFee}",
    });
    expect(aligned[3]).toMatchObject({
      name: "IAAAdminFee",
      content: "{IAAAdminFee}",
    });
    expect(aligned[5]).toMatchObject({
      name: "BrokerFeeGst",
      content: "{BrokerFeeGst}",
    });
  });
});
