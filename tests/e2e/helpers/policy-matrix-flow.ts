import { expect, type Page } from "@playwright/test";

import type { PolicyMatrixScenario } from "../scenarios/policy-matrix/types";
import {
  assertPremiumExpectations,
  assertPremiumIsFirstInSectionStack,
  assertPremiumIsLastInSectionStack,
  completeNotTakenTerminalFlow,
  completeTakenTerminalFlow,
} from "./policy-matrix-assertions";
import {
  fillRequiredPolicyForm,
  openFirstClientAndStartPolicy,
  submitPolicy,
} from "./policy-wizard";

export async function runPolicyMatrixScenario(
  page: Page,
  scenario: PolicyMatrixScenario,
) {
  await openFirstClientAndStartPolicy(page);

  await expect(page.getByLabel("Policy wizard header")).toHaveClass(
    /border-l-primary/,
  );

  const { newPolicyResponsePromises, policyId } = await fillRequiredPolicyForm(
    page,
    scenario.input,
  );

  await Promise.all(newPolicyResponsePromises);

  await assertPremiumExpectations(
    page,
    scenario.expected.premiumBreakdown,
    scenario.expected.referralReasons,
  );

  await assertPremiumIsLastInSectionStack(page);

  await submitPolicy(page, {
    policyId,
    expectedDocuments: scenario.expected.documents,
  });

  await expect(page.locator("[data-policy-phase]")).toHaveAttribute(
    "data-policy-phase",
    "pending",
  );

  await expect(page.getByLabel("Policy wizard header")).toHaveClass(
    /border-l-warning/,
  );

  await assertPremiumIsFirstInSectionStack(page);

  if (scenario.terminalState === "taken") {
    if (!scenario.expected.premiumBreakdownTaken) {
      throw new Error(
        `${scenario.name} is marked taken but has no premiumBreakdownTaken`,
      );
    }

    await completeTakenTerminalFlow(page, {
      premiumBreakdownTaken: scenario.expected.premiumBreakdownTaken,
      referralReasons: scenario.expected.referralReasons,
    });
    return;
  }

  await completeNotTakenTerminalFlow(
    page,
    scenario.expected.premiumBreakdown,
    scenario.expected.referralReasons,
  );
}
