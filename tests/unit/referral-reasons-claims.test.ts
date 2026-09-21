import { describe, expect, it } from "vitest";

import { buildReferralReasons } from "~/lib/pricing/referral-reasons";

const ratingOk = {
  contractWorksAppliedRate: 0.1,
  liabilityAppliedRate: 0.1,
  stampDutyId: 1,
  eslId: 1,
  isTerrorismRateExist: true,
};

describe("buildReferralReasons anyClaimsExceed20k", () => {
  it("includes yes when claims exceed is true", () => {
    const reasons = buildReferralReasons(
      {
        displayHomes: 0,
        existingStructure: 0,
        claimsCountLast3Years: 0,
        anyClaimsExceed20k: true,
        hasExistingContractWorksCover: true,
        plantEquipment: 0,
        liabilityLimitBand: 1,
        dateStart: "2020-01-01",
      },
      ratingOk,
      "$10 Million",
    );
    expect(reasons).toContain(
      "Any claims exceeded $20,000 in value is stated as yes",
    );
    expect(reasons).not.toContain(
      "Any claims exceeded $20,000 in value is stated as no",
    );
  });

  it("omits the claims-exceed reason when claims do not exceed $20,000", () => {
    const reasons = buildReferralReasons(
      {
        displayHomes: 0,
        existingStructure: 0,
        claimsCountLast3Years: 0,
        anyClaimsExceed20k: false,
        hasExistingContractWorksCover: true,
        plantEquipment: 0,
        liabilityLimitBand: 1,
        dateStart: "2020-01-01",
      },
      ratingOk,
      "$10 Million",
    );
    expect(reasons).not.toContain(
      "Any claims exceeded $20,000 in value is stated as no",
    );
  });

  it("treats form select string false as no (not yes)", () => {
    const reasons = buildReferralReasons(
      {
        displayHomes: 0,
        existingStructure: 0,
        claimsCountLast3Years: 0,
        anyClaimsExceed20k: "false",
        hasExistingContractWorksCover: "true",
        plantEquipment: 0,
        liabilityLimitBand: 1,
        dateStart: "2020-01-01",
      },
      ratingOk,
      "$10 Million",
    );
    expect(reasons).not.toContain(
      "Any claims exceeded $20,000 in value is stated as yes",
    );
    expect(reasons).not.toContain(
      "Any claims exceeded $20,000 in value is stated as yes",
    );
  });

  it("omits claims-exceed reason when unset", () => {
    const reasons = buildReferralReasons(
      {
        displayHomes: 0,
        existingStructure: 0,
        claimsCountLast3Years: 0,
        anyClaimsExceed20k: "",
        hasExistingContractWorksCover: true,
        plantEquipment: 0,
        liabilityLimitBand: 1,
        dateStart: "2020-01-01",
      },
      ratingOk,
      "$10 Million",
    );
    expect(reasons.some((r) => r.includes("Any claims exceeded $20,000"))).toBe(
      false,
    );
  });
});
