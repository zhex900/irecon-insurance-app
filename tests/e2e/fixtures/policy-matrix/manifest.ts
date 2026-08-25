import type { PolicyMatrixScenarioMeta } from "./types";

/** All cover type × status combinations. P0 scenarios have fixture modules. */
export const policyMatrixManifest = {
  version: 1,
  description:
    "Policy cover type × final status matrix. Each P0/P1 scenario exports input + expected from its module.",
  captureNotes:
    "Fill expected.premium from CI seed DB: npx tsx scripts/e2e/capture-policy-matrix-premium.mts",
  scenarios: [
    {
      id: "annual-pending",
      coverTypeId: 1,
      coverTypeName: "Annual",
      finalStatus: "pending",
      priority: "P0",
    },
    {
      id: "annual-taken",
      coverTypeId: 1,
      coverTypeName: "Annual",
      finalStatus: "taken",
      priority: "P1",
    },
    {
      id: "annual-not-taken",
      coverTypeId: 1,
      coverTypeName: "Annual",
      finalStatus: "not_taken",
      priority: "P1",
    },
    {
      id: "single-pending",
      coverTypeId: 2,
      coverTypeName: "Single",
      finalStatus: "pending",
      priority: "P0",
    },
    {
      id: "single-taken",
      coverTypeId: 2,
      coverTypeName: "Single",
      finalStatus: "taken",
      priority: "P1",
    },
    {
      id: "single-not-taken",
      coverTypeId: 2,
      coverTypeName: "Single",
      finalStatus: "not_taken",
      priority: "P1",
    },
    {
      id: "owner-builder-pending",
      coverTypeId: 3,
      coverTypeName: "Owner Builder",
      finalStatus: "pending",
      priority: "P1",
    },
    {
      id: "owner-builder-taken",
      coverTypeId: 3,
      coverTypeName: "Owner Builder",
      finalStatus: "taken",
      priority: "P2",
    },
    {
      id: "owner-builder-not-taken",
      coverTypeId: 3,
      coverTypeName: "Owner Builder",
      finalStatus: "not_taken",
      priority: "P2",
    },
  ] satisfies PolicyMatrixScenarioMeta[],
} as const;
