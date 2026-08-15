/**
 * Shared type definitions for generatePremiumExcel request
 * Used by both the worker handler and the app service binding
 */

import type {
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
  AdjustmentBreakdown,
} from "../../../app/lib/types/excel-worker-types";
import type { ExcelWorkerRequest } from "./schemas";

/**
 * Generate Premium Excel Options
 */
export type GeneratePremiumExcelOptions = {
  /** Policy number for file naming */
  policyNumber?: string;
  /** User who generated the report */
  generatedBy?: string;
  /** App version */
  appVersion?: string;
  /** Whether to include adjustment sheet */
  includeAdjustment?: boolean;
  /** Client name for report header */
  clientName?: string;
  /** Any additional options */
  [key: string]: unknown;
};

/**
 * Generate Premium Excel Request Data
 */
export type GeneratePremiumExcelRequestData = {
  /** Report type (must be "premiumWorkbook" for premium reports) */
  reportType: string;
  /** The data for the report */
  data: {
    /** Policy information */
    policy: Policy;
    /** Premium breakdown */
    premium: PremiumBreakdown;
    /** Rating snapshot (optional) */
    rating?: RatingSnapshot;
    /** Adjustment breakdown (optional) */
    adjustment?: AdjustmentBreakdown;
  };
  /** Options for generation */
  options?: GeneratePremiumExcelOptions;
};

/**
 * Generate Premium Excel Function Type
 */
export type GeneratePremiumExcelFunction = (
  requestData: GeneratePremiumExcelRequestData,
) => Promise<Response>;

export type GenerateGenericExcelRequestData = ExcelWorkerRequest;

export type GenerateGenericExcelFunction = (
  requestData: GenerateGenericExcelRequestData,
) => Promise<Response>;
