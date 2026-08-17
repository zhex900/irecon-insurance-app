import { describe, expect, it } from "vitest";

import { resolveWizardDisplayFields } from "~/components/policies/wizard/hooks/wizard/use-wizard-display-fields";
import { computeWizardValidationState } from "~/components/policies/wizard/hooks/wizard/use-wizard-validation-state";
import type { Policy, ReferenceData } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

function policyStub(): Policy {
  return {
    policyId: "pol-1",
    clientId: "client-1",
    policyNumber: "POL-FALLBACK",
    insurerCode: "INS",
    car: { coverTypeId: 2 },
  } as Policy;
}

function referenceStub(): ReferenceData {
  return {
    policyStatuses: [{ policyStatusId: 1, name: "Pending" }],
    coverTypes: [{ coverTypeId: 2, name: "Single Project" }],
    insurers: [{ code: "QBE", name: "QBE Insurance" }],
  } as ReferenceData;
}

describe("computeWizardValidationState", () => {
  it("marks incomplete values invalid and lists field issues", () => {
    const result = computeWizardValidationState({} as CarPolicyFormValues, {});
    expect(result.isFormValid).toBe(false);
    expect(result.invalidIssues.length).toBeGreaterThan(0);
    expect(
      Object.values(result.sectionIssueCounts).some((count) => count > 0),
    ).toBe(true);
  });
});

describe("resolveWizardDisplayFields", () => {
  it("prefers live form values over persisted policy fields", () => {
    const display = resolveWizardDisplayFields(
      policyStub(),
      referenceStub(),
      {
        policyNumber: "  LIVE-99  ",
        coverTypeId: 2,
        insurerCode: "QBE",
        policyStatusId: 1,
      },
    );
    expect(display.livePolicyNumber).toBe("LIVE-99");
    expect(display.coverTypeName).toBe("Single Project");
    expect(display.insurerName).toBe("QBE Insurance");
    expect(display.selectedStatus?.name).toBe("Pending");
  });

  it("falls back to the policy when live fields are empty", () => {
    const display = resolveWizardDisplayFields(
      policyStub(),
      referenceStub(),
      { policyNumber: "   " },
    );
    expect(display.livePolicyNumber).toBe("POL-FALLBACK");
    expect(display.insurerName).toBe("INS");
  });
});
