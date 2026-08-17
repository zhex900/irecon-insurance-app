/**
 * Excel Worker Modules Index
 *
 * Central exports for all Excel generation modules.
 * This simplifies imports and ensures consistent naming.
 */

export {
  addPremiumExcelAdjustmentSheet,
  calculateCarAdjustment,
} from "./excel-adjustment-sheet";
export { buildPremiumExcelWorkbook } from "./excel-build";
export { EXCEL_REPORT_TYPES,WORKER_VERSION } from "./excel-constants";
export type { GenericExcelColumn, GenericExcelInput } from "./excel-generic";
export { buildGenericExcelWorkbook } from "./excel-generic";
export {
  coverTypeLabel,
  liabilityBandLabel,
  stateCode,
  turnoverLabelForCover,
} from "./excel-labels";
export { addPremiumExcelPolicySheet } from "./excel-policy-sheet";
export { addPremiumExcelPremiumSheet } from "./excel-premium-sheet";
export { addPremiumExcelRatesSheet } from "./excel-rates-sheet";
export type {
  BuildPremiumExcelInput,
  PremiumExcelPolicyRefs,
  PremiumExcelRateRefs,
  PremiumExcelSheetContext,
} from "./excel-types";
export { PREMIUM_EXCEL_SPREADSHEET_VERSION } from "./excel-types";
export {
  formatCurrencyCell,
  loadExcelJS,
  setMoneyCell,
  setPercentCell,
  styleWorkbookHeaderRow,
} from "./excel-workbook";
