/**
 * Excel Worker Constants
 *
 * Constants specific to the Excel Worker service.
 * Shared constants should be imported from the app's excel-constants.ts.
 */

/** Environment variable for Excel Worker version */
export const WORKER_VERSION = "2.0.0"; // Default version, can be overridden by env var

/** Default report types supported by the Excel Worker */
export const EXCEL_REPORT_TYPES = {
  POLICY: "policy",
  CLIENT: "client",
  PREMIUM: "premium",
  CUSTOM: "custom",
  EXPORT: "export",
  PREMIUM_WORKBOOK: "premiumWorkbook",
} as const;
