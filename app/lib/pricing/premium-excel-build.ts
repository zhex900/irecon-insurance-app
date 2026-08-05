/**
 * Premium Excel workbook orchestrator (Policy / Rates / Premium / Adjustment sheets).
 * Loaded via dynamic `import("exceljs")` only.
 */
import { getAppVersion } from "~/lib/app-version";
import { APP_NAME } from "~/lib/brand";
import { addPremiumExcelAdjustmentSheet } from "~/lib/pricing/premium-excel-adjustment-sheet";
import {
  coverTypeLabel,
  turnoverLabelForCover,
} from "~/lib/pricing/premium-excel-labels";
import { addPremiumExcelPolicySheet } from "~/lib/pricing/premium-excel-policy-sheet";
import { addPremiumExcelPremiumSheet } from "~/lib/pricing/premium-excel-premium-sheet";
import { addPremiumExcelRatesSheet } from "~/lib/pricing/premium-excel-rates-sheet";
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
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = APP_NAME;
  workbook.created = new Date();
  workbook.modified = new Date();

  const { policy, premium, rating } = input;
  const generatedAt = new Date();
  const version = input.appVersion ?? getAppVersion();
  const car = policy.car;

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
