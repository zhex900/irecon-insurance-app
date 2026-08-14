/**
 * Premium Excel workbook orchestrator - Worker-only version
 *
 * IMPORTANT: This file now delegates to the Excel Worker wrapper for all Excel generation.
 * The actual Excel generation logic has been moved to workers/excel/modules/.
 */

import type { BuildPremiumExcelInput } from "./excel-types";

export type { BuildPremiumExcelInput };

/** Build an .xlsx ArrayBuffer for the live policy premium snapshot using Excel Worker. */
export async function buildPremiumExcelWorkbook(
  input: BuildPremiumExcelInput,
): Promise<Uint8Array> {
  // Delegate to Excel Worker wrapper which calls the external worker service
  const { buildPremiumExcelWorkbook: workerBuildPremiumExcel } =
    await import("~/lib/reports/excel-worker-wrapper.server");

  return workerBuildPremiumExcel(input);
}
