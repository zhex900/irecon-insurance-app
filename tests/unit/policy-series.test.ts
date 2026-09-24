import { beforeEach, describe, expect, it, vi } from "vitest";

import { policyDisplayNumber } from "~/lib/policies/policy-display";
import {
  incrementPolicyNumber,
  normalizeLegacySeriesBase,
  validateSeriesNumberInput,
} from "~/lib/policies/policy-number";
import {
  POLICY_CATEGORY_RENEWAL_ID,
  resolveSeriesNumberFromForm,
} from "~/lib/policies/policy-series";
import {
  createPolicyDraft,
  getPolicy,
} from "~/lib/services/policy/data.service";
import {
  clonePolicy,
  renewPolicy,
} from "~/lib/services/policy/orchestration.service";

vi.mock("~/lib/services/policy/data.service", () => ({
  getPolicy: vi.fn(),
  createPolicyDraft: vi.fn(),
  isSeriesNumberTaken: vi.fn(),
  savePolicy: vi.fn(),
}));

vi.mock("~/lib/services/price/premium.service", () => ({
  calculatePremiumForPolicy: vi.fn(),
  createMessageNote: vi.fn(),
  mergeReferralNotes: vi.fn(),
}));

const basePolicy = {
  policyId: "11111111-1111-1111-1111-111111111111",
  clientId: "22222222-2222-2222-2222-222222222222",
  policyNumber: "ATCCWI0500",
  policySeriesId: "33333333-3333-3333-3333-333333333333",
  seriesNumber: "ATCCWI0487",
  seriesTerm: 0,
  policyCategoryId: 1,
  policyStatusId: 1,
  postcode: "2000",
  stateId: 1,
  dateEffective: "2025-01-01",
  dateStart: "2025-01-01",
  dateEnd: "2025-12-31",
  createdWhen: "2025-01-01T00:00:00.000Z",
  createdBy: "broker@test.com",
  insurerCode: "ATC",
  isDraft: false,
  car: {
    coverTypeId: 1,
    annualCoverTypeId: null,
    siteAddress: "",
    insuredName: "Test Insured",
    estimatedTurnover: 1_000_000,
    businessActivities: "Building",
    insuredContracts: "Contracts",
    geographicalScopes: "AU",
    plantEquipment: 0,
    existingStructure: 0,
    displayHomes: 0,
    claimsCountLast3Years: 0,
    anyClaimsExceed20k: false,
    declarationConfirmed: true,
    contractWorksSumInsured: 1_000_000,
    liabilityLimitBand: 1,
    hasExistingContractWorksCover: false,
    currentInsurer: "",
    maximumConstructionPeriod: 18,
    maximumMaintenancePeriod: 12,
    subLimits: {},
    excesses: {},
    excludedContracts1: "",
    excludedContracts2: "",
    excludedContracts3: "",
    selectedWordingIds: [],
    customWordings: [],
    referralReasons: [],
  },
} as const;

describe("normalizeLegacySeriesBase", () => {
  it("strips -YYYY suffix for legacy renewal numbers", () => {
    expect(normalizeLegacySeriesBase("ATCCWI0487-2024")).toBe("ATCCWI0487");
    expect(normalizeLegacySeriesBase("atccwi0487-2024")).toBe("ATCCWI0487");
  });

  it("leaves standard numbers unchanged", () => {
    expect(normalizeLegacySeriesBase("ATCCWI0487")).toBe("ATCCWI0487");
  });

  it("strips year-month and full-date legacy suffixes", () => {
    expect(normalizeLegacySeriesBase("ATCCWI0487-2024-06")).toBe("ATCCWI0487");
    expect(normalizeLegacySeriesBase("ATCCWI0487-2024-06-15")).toBe(
      "ATCCWI0487",
    );
  });
});

describe("validateSeriesNumberInput", () => {
  it("accepts composed ATCCWI numbers", () => {
    const result = validateSeriesNumberInput("487");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.seriesNumber).toBe("ATCCWI487");
    }
  });
});

describe("resolveSeriesNumberFromForm", () => {
  it("keeps existing series for renewal category", () => {
    expect(
      resolveSeriesNumberFromForm("ATCCWI0487", "999", {
        policyCategoryId: POLICY_CATEGORY_RENEWAL_ID,
        terminalLocked: false,
      }),
    ).toBe("ATCCWI0487");
  });

  it("applies submitted suffix for non-renewal", () => {
    expect(
      resolveSeriesNumberFromForm("ATCCWI0487", "999", {
        policyCategoryId: 1,
        terminalLocked: false,
      }),
    ).toBe("ATCCWI999");
  });
});

describe("policyDisplayNumber", () => {
  it("prefers series number over internal term number", () => {
    expect(
      policyDisplayNumber({
        seriesNumber: "ATCCWI0487",
        policyNumber: "ATCCWI0999",
      }),
    ).toBe("ATCCWI0487");
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("renewPolicy", () => {
  it("reuses series and links copiedFromPolicyId", async () => {
    vi.mocked(getPolicy).mockResolvedValue({ ...basePolicy });
    vi.mocked(createPolicyDraft).mockResolvedValue({
      ...basePolicy,
      policyId: "44444444-4444-4444-4444-444444444444",
      policyNumber: "ATCCWI0501",
      seriesNumber: "ATCCWI0487",
      copiedFromPolicyId: basePolicy.policyId,
    });

    await renewPolicy(basePolicy.policyId, "broker@test.com");

    expect(createPolicyDraft).toHaveBeenCalledWith(
      basePolicy.clientId,
      expect.objectContaining({
        policySeriesId: basePolicy.policySeriesId,
        seriesNumber: basePolicy.seriesNumber,
        copiedFromPolicyId: basePolicy.policyId,
      }),
      "broker@test.com",
    );
    const partial = vi.mocked(createPolicyDraft).mock.calls[0]?.[1];
    expect(partial?.policyNumber).toBeUndefined();
    expect(incrementPolicyNumber(basePolicy.seriesNumber)).not.toBe(
      basePolicy.seriesNumber,
    );
  });
});

describe("clonePolicy", () => {
  it("does not reuse the source series id", async () => {
    vi.mocked(getPolicy).mockResolvedValue({ ...basePolicy });
    vi.mocked(createPolicyDraft).mockResolvedValue({
      ...basePolicy,
      policyId: "55555555-5555-5555-5555-555555555555",
      policySeriesId: "66666666-6666-6666-6666-666666666666",
      seriesNumber: "ATCCWI0502",
      policyNumber: "ATCCWI0502",
      copiedFromPolicyId: basePolicy.policyId,
    });

    await clonePolicy(basePolicy.policyId, "broker@test.com");

    const partial = vi.mocked(createPolicyDraft).mock.calls.at(-1)?.[1];
    expect(partial?.policySeriesId).toBeUndefined();
    expect(partial?.copiedFromPolicyId).toBe(basePolicy.policyId);
  });
});
