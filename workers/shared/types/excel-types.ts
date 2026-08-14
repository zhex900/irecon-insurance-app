/**
 * Excel worker TypeScript interfaces derived from Zod schemas
 * All types are inferred from shared schemas to ensure single source of truth
 */

// Re-export types from schemas
import type {
  GeneratePremiumWorkbookInput,
  GeneratePremiumWorkbookOutput,
  GenerateAdjustmentSheetInput,
  GenerateAdjustmentSheetOutput,
  ExportReportInput,
  ExportReportOutput,
} from "../schemas/excel";

export type {
  GeneratePremiumWorkbookInput,
  GeneratePremiumWorkbookOutput,
  GenerateAdjustmentSheetInput,
  GenerateAdjustmentSheetOutput,
  ExportReportInput,
  ExportReportOutput,
};

// RPC service interface for Excel worker
export interface ExcelRpcService {
  /**
   * Generate a comprehensive premium workbook
   */
  generatePremiumWorkbook(
    input: GeneratePremiumWorkbookInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<GeneratePremiumWorkbookOutput>;

  /**
   * Generate an adjustment sheet
   */
  generateAdjustmentSheet(
    input: GenerateAdjustmentSheetInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<GenerateAdjustmentSheetOutput>;

  /**
   * Export a generic report to Excel format
   */
  exportReport(
    input: ExportReportInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<ExportReportOutput>;

  /**
   * Health check endpoint
   */
  healthCheck(metadata?: { requestId?: string }): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    version: string;
    uptime?: number;
  }>;

  /**
   * Get service information
   */
  getServiceInfo(metadata?: { requestId?: string }): Promise<{
    service: string;
    version: string;
    environment?: string;
    capabilities: string[];
    endpoints: string[];
    uptime?: number;
  }>;
}

// Excel client configuration
export interface ExcelClientConfig {
  serviceBinding: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  serviceName?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

// Excel generation metadata
export interface ExcelGenerationMetadata {
  generationId: string;
  policyNumber?: string;
  clientName?: string;
  generatedBy: string;
  generationTime: number;
  fileSize: number;
  sheetCount: number;
  includedSheets: string[];
}

// Workbook sheet definition
export interface WorkbookSheet {
  name: string;
  data: unknown[];
  columns: Array<{
    header: string;
    width?: number;
    format?: string;
    type?: "string" | "number" | "date" | "currency" | "percentage";
  }>;
  frozenRows?: number;
  frozenColumns?: number;
  printSettings?: {
    fitToPage?: boolean;
    orientation?: "portrait" | "landscape";
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

// Excel format options
export interface ExcelFormatOptions {
  includeFormulas?: boolean;
  includeFormatting?: boolean;
  includeCharts?: boolean;
  includePivotTables?: boolean;
  passwordProtect?: boolean;
  password?: string;
  compressionLevel?: "none" | "fast" | "maximum";
  calculateFormulas?: boolean;
}

// Adjustment calculation result
export interface AdjustmentCalculation {
  originalPremium: number;
  adjustedPremium: number;
  adjustmentAmount: number;
  adjustmentPercentage: number;
  adjustmentReasons: string[];
  validationErrors?: string[];
}

// Rate sheet interface
export interface RateSheet {
  sheetName: string;
  rates: Array<{
    coverageType: string;
    rate: number;
    minPremium: number;
    maxPremium: number;
    conditions: string[];
    effectiveDate: string;
    expiryDate: string;
  }>;
  version: string;
}

// Premium breakdown interface
export interface PremiumBreakdownValue {
  component: string;
  amount: number;
  percentage: number;
  taxable: boolean;
  calculationMethod: string;
  notes?: string;
}

// Export interface for client usage
export interface ExcelExportResult {
  success: boolean;
  workbook?: {
    url: string;
    size: number;
    mimeType: string;
    filename: string;
    downloadUrl?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: ExcelGenerationMetadata;
  processingTime: number;
}
