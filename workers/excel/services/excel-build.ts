/**
 * Premium Excel workbook orchestrator (Policy / Rates / Premium / Adjustment sheets).
 * Worker-compatible version.
 *
 * IMPORTANT: This replicates the logic from the working branch for consistent Excel output.
 */
import {
  type BuildPremiumExcelInput,
  PREMIUM_EXCEL_SPREADSHEET_VERSION,
} from "./excel-types";
import {
  addPremiumExcelAdjustmentSheet,
  addPremiumExcelPolicySheet,
  addPremiumExcelPremiumSheet,
  addPremiumExcelRatesSheet,
  calculateCarAdjustment,
  coverTypeLabel,
  loadExcelJS,
  turnoverLabelForCover,
} from "./index";

export { PREMIUM_EXCEL_SPREADSHEET_VERSION };
export type { BuildPremiumExcelInput };

/** Build an .xlsx ArrayBuffer for the live policy premium snapshot. */
export async function buildPremiumExcelWorkbook(
  input: BuildPremiumExcelInput,
): Promise<Uint8Array> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Irecon Insurance";
  workbook.created = new Date();
  workbook.modified = new Date();

  const { policy, premium, rating } = input;
  const generatedAt = new Date();
  const version = input.appVersion ?? "1.0.0";
  const car = policy.car;

  // Calculate adjustment if we have rating and adjustment input
  const adjustment =
    input.adjustment && rating
      ? calculateCarAdjustment({
          originalTurnover: input.adjustment.originalTurnover,
          adjustmentTurnover: input.adjustment.adjustmentTurnover,
          stampDutyExempt: input.adjustment.stampDutyExempt,
          premium,
          rating,
        })
      : input.adjustment;

  const ctx = {
    policy,
    premium,
    rating,
    adjustment,
    coverLabel: coverTypeLabel(car.coverTypeId),
    turnoverLabel: turnoverLabelForCover(car.coverTypeId),
    generatedAt,
    version,
  };

  const sheet = workbook.addWorksheet("Premium");
  sheet.getColumn(1).width = 38;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 18;

  const INPUT = addPremiumExcelPolicySheet(workbook, ctx);
  const RATE = addPremiumExcelRatesSheet(workbook, ctx);
  addPremiumExcelPremiumSheet(sheet, ctx, INPUT, RATE);
  addPremiumExcelAdjustmentSheet(workbook, ctx, INPUT, RATE);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
