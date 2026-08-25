import { annualPendingExpected, annualPendingInput } from "./annual-pending";
import { policyMatrixManifest } from "./manifest";
import { singlePendingExpected, singlePendingInput } from "./single-pending";
import type { PolicyMatrixFixture } from "./types";

export type { PolicyMatrixFixture } from "./types";
export type {
  PolicyMatrixExpected,
  PolicyMatrixExpectedPremium,
  PolicyMatrixFinalStatus,
  PolicyMatrixFormInput,
  PolicyMatrixInput,
  PolicyMatrixScenarioMeta,
} from "./types";

export { policyMatrixManifest };

export const policyMatrixFixtures = {
  "single-pending": {
    input: singlePendingInput,
    expected: singlePendingExpected,
  },
  "annual-pending": {
    input: annualPendingInput,
    expected: annualPendingExpected,
  },
} satisfies Record<string, PolicyMatrixFixture>;

export type PolicyMatrixScenarioId = keyof typeof policyMatrixFixtures;

export function getPolicyMatrixFixture(
  scenarioId: string,
): PolicyMatrixFixture {
  const fixture = policyMatrixFixtures[scenarioId as PolicyMatrixScenarioId];
  if (!fixture) {
    throw new Error(
      `No policy-matrix fixture for "${scenarioId}". Add a module under tests/e2e/fixtures/policy-matrix/.`,
    );
  }
  return fixture;
}

export function listPolicyMatrixScenarioIds(priority?: string): string[] {
  return policyMatrixManifest.scenarios
    .filter((row) => !priority || row.priority === priority)
    .map((row) => row.id)
    .filter((id) => id in policyMatrixFixtures);
}
