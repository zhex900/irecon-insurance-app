/**
 * Client-side type definitions for premium Excel functionality.
 * Separated from server-only code to avoid module resolution issues.
 */

import type { Policy, PolicyDocument, PremiumBreakdown, RatingSnapshot, AdjustmentBreakdown } from "~/lib/db/types";

export interface AdjustmentInput {
  originalTurnover: number;
  adjustmentTurnover: number;
  stampDutyExempt: boolean;
}

export interface BuildPremiumExcelInput {
  policy: Policy;
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  adjustment?: PremiumBreakdown | AdjustmentInput | AdjustmentBreakdown;
  generatedBy: string;
  appVersion?: string;
}

export const PREMIUM_EXCEL_TEMPLATE_KEY = "premium-breakdown-xlsx";
export const PREMIUM_EXCEL_SPREADSHEET_VERSION = "2.1.0";

// Types for Excel sheet references
export type PremiumExcelPolicyRefs = any;
export type PremiumExcelRateRefs = any;
export type PremiumExcelSheetContext = any;