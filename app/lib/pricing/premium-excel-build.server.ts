/**
 * Premium Excel workbook orchestrator (Policy / Rates / Premium / Adjustment sheets).
 * Uses Excel Worker service to move ExcelJS out of main bundle.
 */
import { getAppVersion } from "~/lib/app-version";
import {
  PREMIUM_EXCEL_SPREADSHEET_VERSION,
  type BuildPremiumExcelInput,
} from "~/lib/pricing/premium-excel-types";
import { calculateCarAdjustment } from "~/server/pricing/car-adjustment-calculator";

export { PREMIUM_EXCEL_SPREADSHEET_VERSION };
export type { BuildPremiumExcelInput };

/** Build an .xlsx ArrayBuffer for the live policy premium snapshot. */
export async function buildPremiumExcelWorkbook(
  input: BuildPremiumExcelInput,
): Promise<Uint8Array> {
  const { policy, premium, rating } = input;
  const version = input.appVersion ?? getAppVersion();

  let adjustment;
  if (input.adjustment && rating) {
    // Check what type of adjustment we have
    if ('originalTurnover' in input.adjustment && 'adjustmentTurnover' in input.adjustment) {
      // It's an AdjustmentInput - needs calculation
      adjustment = calculateCarAdjustment({
        originalTurnover: input.adjustment.originalTurnover,
        adjustmentTurnover: input.adjustment.adjustmentTurnover,
        stampDutyExempt: input.adjustment.stampDutyExempt,
        premium,
        rating,
      });
    } else {
      // It's either PremiumBreakdown or AdjustmentBreakdown - pass through
      adjustment = input.adjustment;
    }
  } else {
    adjustment = input.adjustment;
  }

  // Call Excel Worker service for premium workbook generation
  const { buildPremiumExcelWorkbook: excelWorkerBuild } = await import("~/lib/reports/excel-worker-wrapper.server");
  
  // Convert adjustment to Excel worker format
  let excelWorkerAdjustment;
  if (adjustment) {
    if ('originalTurnover' in adjustment) {
      // It's AdjustmentInput or AdjustmentBreakdown
      excelWorkerAdjustment = {
        originalTurnover: adjustment.originalTurnover,
        adjustmentTurnover: adjustment.adjustmentTurnover,
        stampDutyExempt: adjustment.stampDutyExempt,
      };
    }
    // If it's PremiumBreakdown, we don't pass adjustment to Excel worker
  }
  
  return excelWorkerBuild({
    ...input,
    adjustment: excelWorkerAdjustment
  });
}
