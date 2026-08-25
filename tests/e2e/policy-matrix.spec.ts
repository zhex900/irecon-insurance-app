import { test } from "@playwright/test";

import { runPolicyMatrixScenario } from "./helpers/policy-matrix-flow";
import { policyMatrixScenarios } from "./scenarios/policy-matrix";

test.describe.configure({ mode: "serial" });

test.describe("policy matrix @policy-matrix", () => {
  for (const scenario of policyMatrixScenarios) {
    test(`${scenario.name}: create → premium → documents → status`, async ({
      page,
    }) => {
      await runPolicyMatrixScenario(page, scenario);
    });
  }
});
