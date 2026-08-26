import { test } from "@playwright/test";

import { runPolicyMatrixScenario } from "./helpers/policy-matrix-flow";
import { policyMatrixScenarios } from "./scenarios/policy-matrix";

test.describe("policy matrix @policy-matrix", () => {
  // Terminal status can trigger document regeneration on preview (PDF worker cold start).
  test.describe.configure({
    mode: process.env.CI ? "serial" : "parallel",
    timeout: process.env.CI ? 180_000 : 120_000,
  });

  for (const scenario of policyMatrixScenarios) {
    test(`${scenario.name}: create → premium → documents → status`, async ({
      page,
    }) => {
      await runPolicyMatrixScenario(page, scenario);
    });
  }
});
