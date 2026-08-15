/**
 * Shared type definitions for generatePremiumExcel request
 * Used by both the worker handler and the app service binding
 */

import type { ReportExcelColumn } from "~/lib/reports/report-excel.server";
import type {
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
  AdjustmentBreakdown,
} from "../../../app/lib/types/excel-worker-types";
import type { ExcelWorkerEnv } from "./env";

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
  env: ExcelWorkerEnv,
) => Promise<Response>;

export type GenerateGenericExcelRequestData = {
  /** Report type (must be "custom" for custom reports) */
  reportType: string;
  /** The data for the report */
  data: {
    /** Columns for the report */
    columns: ReportExcelColumn[];
    /** Rows for the report */
    rows: Array<Record<string, string | number | null | undefined>>;
  };
};

/**
 * Generate Generic Excel Function Type
 */
export type GenerateGenericExcelFunction = (
  requestData: GenerateGenericExcelRequestData,
  env: ExcelWorkerEnv,
) => Promise<Response>;
