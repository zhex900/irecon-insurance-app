import { describe, expect, it } from "vitest";

import { policyForDocumentConfirm } from "~/components/policies/wizard/hooks/composite/submit-helpers";
import type { Policy } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

function policyStub(overrides: Partial<Policy["car"]> = {}): Policy {
  return {
    policyId: "pol-1",
    clientId: "client-1",
    stateId: 1,
    car: {
      coverTypeId: 2,
      annualCoverTypeId: 9,
      ...overrides,
    },
  } as Policy;
}

describe("policyForDocumentConfirm", () => {
  it("uses live form cover type and state", () => {
    const next = policyForDocumentConfirm(policyStub(), {
      coverTypeId: 1,
      annualCoverTypeId: 4,
      stateId: 3,
    } as CarPolicyFormValues);
    expect(next.stateId).toBe(3);
    expect(next.car.coverTypeId).toBe(1);
    expect(next.car.annualCoverTypeId).toBe(4);
  });

  it("clears annual cover type when the live cover is not Annual", () => {
    const next = policyForDocumentConfirm(policyStub(), {
      coverTypeId: 2,
      annualCoverTypeId: 4,
      stateId: 1,
    } as CarPolicyFormValues);
    expect(next.car.annualCoverTypeId).toBeNull();
  });
});
