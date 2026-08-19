import { describe, expect, it } from "vitest";

import { legacyPolicyUuid } from "../../scripts/lib/legacy-id-map.mts";
import { dedupeLegacyPolicyNumbers } from "../../scripts/lib/legacy-policy-mapper.mts";
import type { LegacyPolicyRow } from "../../scripts/lib/legacy-payload.ts";

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
  it("keeps the earliest policy number unchanged", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({ policyId: 1, createdWhen: "2020-01-01T00:00:00.000Z" }),
      policyRow({
        policyId: 2,
        dateStart: "2024-06-01",
        createdWhen: "2024-06-01T00:00:00.000Z",
      }),
    ]);

    expect(rows.find((row) => row.policyId === 1)?.policyNumber).toBe(
      "ATCCWI0487",
    );
    expect(rows.find((row) => row.policyId === 2)?.policyNumber).toBe(
      "ATCCWI0487-2024",
    );
  });

  it("uses inception year for renewals with different years", () => {
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

    expect(rows.find((row) => row.policyId === 11)?.policyNumber).toBe(
      "ATCCWI0487-2022",
    );
    expect(rows.find((row) => row.policyId === 12)?.policyNumber).toBe(
      "ATCCWI0487-2023",
    );
  });

  it("falls back to year-month when the year suffix is already taken", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({ policyId: 20, createdWhen: "2020-01-01T00:00:00.000Z" }),
      policyRow({
        policyId: 21,
        dateStart: "2024-01-01",
        createdWhen: "2024-01-01T00:00:00.000Z",
      }),
      policyRow({
        policyId: 22,
        dateStart: "2024-06-01",
        createdWhen: "2024-06-01T00:00:00.000Z",
      }),
    ]);

    expect(rows.find((row) => row.policyId === 21)?.policyNumber).toBe(
      "ATCCWI0487-2024",
    );
    expect(rows.find((row) => row.policyId === 22)?.policyNumber).toBe(
      "ATCCWI0487-2024-06",
    );
  });

  it("falls back to full inception date when year-month is already taken", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({ policyId: 30, createdWhen: "2020-01-01T00:00:00.000Z" }),
      policyRow({
        policyId: 31,
        dateStart: "2024-06-01",
        createdWhen: "2024-06-01T00:00:00.000Z",
      }),
      policyRow({
        policyId: 32,
        dateStart: "2024-06-10",
        createdWhen: "2024-06-10T00:00:00.000Z",
      }),
      policyRow({
        policyId: 33,
        dateStart: "2024-06-10",
        createdWhen: "2024-06-10T12:00:00.000Z",
      }),
    ]);

    expect(rows.find((row) => row.policyId === 31)?.policyNumber).toBe(
      "ATCCWI0487-2024",
    );
    expect(rows.find((row) => row.policyId === 32)?.policyNumber).toBe(
      "ATCCWI0487-2024-06",
    );
    expect(rows.find((row) => row.policyId === 33)?.policyNumber).toBe(
      "ATCCWI0487-2024-06-10",
    );
  });

  it("falls back to hash when year, month, and full date are already taken", () => {
    const { rows } = dedupeLegacyPolicyNumbers([
      policyRow({ policyId: 40, createdWhen: "2020-01-01T00:00:00.000Z" }),
      policyRow({
        policyId: 41,
        dateStart: "2024-06-15",
        createdWhen: "2024-06-15T00:00:00.000Z",
      }),
      policyRow({
        policyId: 42,
        dateStart: "2024-06-15",
        createdWhen: "2024-06-15T06:00:00.000Z",
      }),
      policyRow({
        policyId: 43,
        dateStart: "2024-06-15",
        createdWhen: "2024-06-15T12:00:00.000Z",
      }),
      policyRow({
        policyId: 44,
        dateStart: "2024-06-15",
        createdWhen: "2024-06-15T18:00:00.000Z",
      }),
    ]);

    expect(rows.find((row) => row.policyId === 41)?.policyNumber).toBe(
      "ATCCWI0487-2024",
    );
    expect(rows.find((row) => row.policyId === 42)?.policyNumber).toBe(
      "ATCCWI0487-2024-06",
    );
    expect(rows.find((row) => row.policyId === 43)?.policyNumber).toBe(
      "ATCCWI0487-2024-06-15",
    );
    expect(rows.find((row) => row.policyId === 44)?.policyNumber).toBe(
      `ATCCWI0487-${legacyPolicyUuid(44).slice(0, 8)}`,
    );
  });
});
