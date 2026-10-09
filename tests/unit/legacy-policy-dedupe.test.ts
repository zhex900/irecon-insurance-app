import { describe, expect, it } from "vitest";

import type { LegacyPolicyRow } from "../../scripts/db/legacy/lib/legacy-payload.ts";
import { dedupeLegacyPolicyNumbers } from "../../scripts/db/legacy/lib/legacy-policy-mapper.mts";

function policyRow(
  overrides: Partial<LegacyPolicyRow> & Pick<LegacyPolicyRow, "policyId">,
): LegacyPolicyRow {
  return {
    clientId: 1,
    policyNumber: "ATCCWI0487",
    policyAction: "RWL",
    policyStatusId: 1,
    postcode: "2000",
    stateCode: "NSW",
    dateStart: "2024-01-01",
    dateEnd: "2025-01-01",
    insurerCode: "ATC",
    createdWhen: "2024-01-01T00:00:00.000Z",
    coverTypeId: 1,
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
    maximumConstructionPeriod: 18,
    maximumMaintenancePeriod: 12,
    contractWorksExistingStructurePremium: 0,
    contractWorksDisplayHomesPremium: 0,
    manualTaxOverride: false,
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
      additionalCostOfWorking: "Not Insured",
    },
    excludedContracts1: "",
    excludedContracts2: "",
    excludedContracts3: "",
    excesses: {
      excessSection1A: "",
      excessSection1B: "",
      excessSection1C: "",
      excessSection2: "",
      excessSection3: "",
    },
    wordings: [],
    notes: [],
    premium: null,
    rating: null,
    adjustment: null,
    ...overrides,
  };
}

describe("dedupeLegacyPolicyNumbers", () => {
  it("keeps the earliest term on the series base with series_term 0", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({ policyId: 1, createdWhen: "2020-01-01T00:00:00.000Z" }),
      policyRow({
        policyId: 2,
        dateStart: "2024-06-01",
        createdWhen: "2024-06-01T00:00:00.000Z",
      }),
    ]);

    const first = rows.find((row) => row.policyId === 1);
    const renewal = rows.find((row) => row.policyId === 2);

    expect(first?.policyNumber).toBe("ATCCWI0487");
    expect(first?.seriesNumber).toBe("ATCCWI0487");
    expect(first?.seriesTerm).toBe(0);

    expect(renewal?.seriesNumber).toBe("ATCCWI0487");
    expect(renewal?.seriesTerm).toBe(1);
    expect(renewal?.policyNumber).toMatch(/^ATCCWI\d{4}$/);
    expect(renewal?.policyNumber).not.toBe("ATCCWI0487");
    expect(renewal?.policyNumber).toBe("ATCCWI1000");
  });

  it("assigns increasing series_term and distinct policy numbers for multiple renewals", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({ policyId: 10, createdWhen: "2021-01-01T00:00:00.000Z" }),
      policyRow({
        policyId: 11,
        dateStart: "2022-03-15",
        createdWhen: "2022-03-15T00:00:00.000Z",
      }),
      policyRow({
        policyId: 12,
        dateStart: "2023-08-01",
        createdWhen: "2023-08-01T00:00:00.000Z",
      }),
    ]);

    expect(rows.find((row) => row.policyId === 11)?.seriesTerm).toBe(1);
    expect(rows.find((row) => row.policyId === 12)?.seriesTerm).toBe(2);

    const renewalNumbers = rows
      .filter((row) => row.policyId !== 10)
      .map((row) => row.policyNumber);
    expect(new Set(renewalNumbers).size).toBe(2);
    expect(renewalNumbers).toEqual(["ATCCWI1000", "ATCCWI1001"]);
  });

  it("groups legacy year-suffixed rows under one series base", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({ policyId: 20, createdWhen: "2020-01-01T00:00:00.000Z" }),
      policyRow({
        policyId: 21,
        policyNumber: "ATCCWI0487-2024",
        dateStart: "2024-01-01",
        createdWhen: "2024-01-01T00:00:00.000Z",
      }),
    ]);

    expect(rows.find((row) => row.policyId === 21)?.seriesNumber).toBe(
      "ATCCWI0487",
    );
    expect(rows.find((row) => row.policyId === 21)?.seriesTerm).toBe(1);
    expect(rows.find((row) => row.policyId === 21)?.policyNumber).toBe(
      "ATCCWI1000",
    );
  });

  it("does not merge renewal chains for different clients with the same legacy number", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({
        policyId: 40,
        clientId: 1,
        createdWhen: "2020-01-01T00:00:00.000Z",
      }),
      policyRow({
        policyId: 41,
        clientId: 2,
        createdWhen: "2020-01-01T00:00:00.000Z",
      }),
    ]);

    const client1 = rows.find((row) => row.policyId === 40);
    const client2 = rows.find((row) => row.policyId === 41);

    expect(client1?.seriesNumber).toBe("ATCCWI0487");
    expect(client1?.seriesTerm).toBe(0);
    expect(client2?.seriesNumber).toBe("ATCCWI1000");
    expect(client2?.seriesTerm).toBe(0);
    expect(client2?.policyNumber).toBe("ATCCWI1000");
  });

  it("gap-fills policy numbers already used by other policies in the export", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({
        policyId: 30,
        policyNumber: "ATCCWI1000",
        createdWhen: "2019-01-01T00:00:00.000Z",
      }),
      policyRow({ policyId: 31, createdWhen: "2020-01-01T00:00:00.000Z" }),
      policyRow({
        policyId: 32,
        createdWhen: "2024-06-01T00:00:00.000Z",
      }),
    ]);

    expect(rows.find((row) => row.policyId === 32)?.policyNumber).toBe(
      "ATCCWI1000",
    );
    expect(rows.find((row) => row.policyId === 30)?.policyNumber).toBe(
      "ATCCWI1001",
    );
  });
});
