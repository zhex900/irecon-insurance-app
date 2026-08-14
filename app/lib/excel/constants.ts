/**
 * Excel-related constants shared across app and worker.
 * Keep this file minimal - only truly shared constants belong here.
 *
 * NOTE: This file is imported by both client and server code.
 * Do not include process.env or any server-only references here.
 */

/** Template key for premium Excel documents in the database. */
export const PREMIUM_EXCEL_TEMPLATE_KEY = "premium-breakdown-xlsx";

/** Prefix for premium Excel document filenames */
export const PREMIUM_EXCEL_FILENAME_PREFIX = "Premium-Breakdown";

/**
 * Excel spreadsheet version.
 * Bump when Premium / Policy / Rates / Adjustment sheet layout or formulas change.
 */
export const PREMIUM_EXCEL_SPREADSHEET_VERSION = "1.4";

/** Content type for Excel files */
export const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** File extension for Excel files */
export const EXCEL_FILE_EXTENSION = ".xlsx";
