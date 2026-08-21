import { describe, expect, it } from "vitest";

import { derivePolicyPhase } from "~/components/policies/wizard/shared/policy-phase";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { POLICY_STATUS } from "~/lib/zod/policy-car";

function makePolicy(
  overrides: Partial<Omit<Policy, "car">> & {
    car?: Partial<Policy["car"]>;
  } = {},
): Policy {
  const { car: carOverrides, ...rest } = overrides;
  return {
    policyId: "p1",
    policyNumber: "TEST-1",
    clientId: "c1",
    policyStatusId: POLICY_STATUS.Pending,
    isDraft: true,
    car: { premium: null, ...carOverrides },
    ...rest,
  } as Policy;
}

describe("derivePolicyPhase", () => {
  it("returns new for draft with new URL", () => {
    expect(derivePolicyPhase(makePolicy(), true)).toBe("new");
  });

  it("returns pending for submitted draft without new URL", () => {
    expect(
      derivePolicyPhase(
        makePolicy({
          isDraft: false,
          car: {
            premium: { originalTotalPremium: 100 } as PremiumBreakdown,
          },
        }),
        false,
      ),
    ).toBe("pending");
  });

  it("returns taken when saved status is Taken", () => {
    expect(
      derivePolicyPhase(
        makePolicy({ policyStatusId: POLICY_STATUS.Taken, isDraft: false }),
        false,
      ),
    ).toBe("taken");
  });

  it("returns not-taken when saved status is Not taken", () => {
    expect(
      derivePolicyPhase(
        makePolicy({ policyStatusId: POLICY_STATUS.NotTaken, isDraft: false }),
        false,
      ),
    ).toBe("not-taken");
  });

  it("previews taken from form status while saved is Pending", () => {
    expect(derivePolicyPhase(makePolicy(), false, POLICY_STATUS.Taken)).toBe(
      "taken",
    );
  });
});
