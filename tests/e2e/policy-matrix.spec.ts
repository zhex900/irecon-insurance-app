import { test } from "@playwright/test";

import { runPolicyMatrixScenario } from "./helpers/policy-matrix-flow";
import { policyMatrixScenarios } from "./scenarios/policy-matrix";

test.describe("policy matrix @policy-matrix", () => {
  test.describe.configure({ mode: "parallel", timeout: 120_000 });

  for (const scenario of policyMatrixScenarios) {
    test(`${scenario.name}: create → premium → documents → status`, async ({
      page,
    }) => {
      await runPolicyMatrixScenario(page, scenario);
    });
  }
});
