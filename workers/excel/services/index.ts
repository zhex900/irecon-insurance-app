/**
 * Excel Worker Modules Index
 *
 * Central exports for all Excel generation modules.
 * This simplifies imports and ensures consistent naming.
 */

export { PREMIUM_EXCEL_SPREADSHEET_VERSION } from "./excel-types";

export { WORKER_VERSION, EXCEL_REPORT_TYPES } from "./excel-constants";

export type {
  BuildPremiumExcelInput,
  PremiumExcelPolicyRefs,
  PremiumExcelRateRefs,
  PremiumExcelSheetContext,
} from "./excel-types";

export { buildPremiumExcelWorkbook } from "./excel-build";
export { addPremiumExcelPolicySheet } from "./excel-policy-sheet";
export { addPremiumExcelPremiumSheet } from "./excel-premium-sheet";
export { addPremiumExcelRatesSheet } from "./excel-rates-sheet";
export {
  addPremiumExcelAdjustmentSheet,
  calculateCarAdjustment,
} from "./excel-adjustment-sheet";

export {
  coverTypeLabel,
  liabilityBandLabel,
  stateCode,
  turnoverLabelForCover,
} from "./excel-labels";

export {
  loadExcelJS,
  formatCurrencyCell,
  setMoneyCell,
  setPercentCell,
  styleWorkbookHeaderRow,
} from "./excel-workbook";

export { buildGenericExcelWorkbook } from "./excel-generic";
export type { GenericExcelColumn, GenericExcelInput } from "./excel-generic";
