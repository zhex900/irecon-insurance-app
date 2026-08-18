import { describe, expect, it } from "vitest";

import {
  hasPolicyChanged,
  shouldApplyPremiumResponse,
} from "~/components/policies/wizard/hooks/premium/use-premium-utils";

describe("shouldApplyPremiumResponse", () => {
  it("applies the latest recalculate when the broker has not edited", () => {
    expect(
      shouldApplyPremiumResponse({
        hasPremium: true,
        isManualEdit: false,
        responseRequestId: 3,
        latestRequestId: 3,
      }),
    ).toBe(true);
  });

  it("ignores a stale recalculate that finished after a newer request", () => {
    expect(
      shouldApplyPremiumResponse({
        hasPremium: true,
        isManualEdit: false,
        responseRequestId: 2,
        latestRequestId: 3,
      }),
    ).toBe(false);
  });

  it("never overwrites click-edited Premium Breakdown", () => {
    expect(
      shouldApplyPremiumResponse({
        hasPremium: true,
        isManualEdit: true,
        responseRequestId: 4,
        latestRequestId: 4,
      }),
    ).toBe(false);
  });

  it("skips responses with no premium payload", () => {
    expect(
      shouldApplyPremiumResponse({
        hasPremium: false,
        isManualEdit: false,
        responseRequestId: 1,
        latestRequestId: 1,
      }),
    ).toBe(false);
  });

  it("applies untagged premium responses so non-calc actions still work", () => {
    expect(
      shouldApplyPremiumResponse({
        hasPremium: true,
        isManualEdit: false,
        responseRequestId: undefined,
        latestRequestId: 2,
      }),
    ).toBe(true);
  });
});

describe("hasPolicyChanged", () => {
  const premiumA = { contractWorksBasePremium: 1 } as never;
  const premiumB = { contractWorksBasePremium: 1 } as never;

  it("treats a missing previous snapshot as a change", () => {
    expect(hasPolicyChanged({ policyId: "a", premium: premiumA }, null)).toBe(
      true,
    );
  });

  it("treats a new loader premium object as a change so reset can apply", () => {
    expect(
      hasPolicyChanged(
        { policyId: "pol-1", premium: premiumB },
        { policyId: "pol-1", premium: premiumA },
      ),
    ).toBe(true);
  });

  it("ignores the same policy and premium reference", () => {
    expect(
      hasPolicyChanged(
        { policyId: "pol-1", premium: premiumA },
        { policyId: "pol-1", premium: premiumA },
      ),
    ).toBe(false);
  });

  it("detects navigating to a different policy", () => {
    expect(
      hasPolicyChanged(
        { policyId: "pol-2", premium: premiumA },
        { policyId: "pol-1", premium: premiumA },
      ),
    ).toBe(true);
  });
});
