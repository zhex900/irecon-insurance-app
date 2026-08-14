/**
 * Type-safe Excel service client
 */

import { RpcClient } from "../rpc/RpcClient";
import type { ServiceBinding } from "../rpc/types";
import type {
  GeneratePremiumWorkbookInput,
  GeneratePremiumWorkbookOutput,
  GenerateAdjustmentSheetInput,
  GenerateAdjustmentSheetOutput,
  ExportReportInput,
  ExportReportOutput,
} from "../schemas/excel/premium-workbook.schema";

export interface ExcelServiceClientOptions {
  /** Service binding instance */
  serviceBinding: ServiceBinding;
  /** Base URL for the service */
  baseUrl?: string;
  /** Default timeout for requests (ms) */
  timeoutMs?: number;
  /** Maximum number of retries */
  maxRetries?: number;
}

export class ExcelServiceClient {
  private rpcClient: RpcClient;

  constructor(options: ExcelServiceClientOptions) {
    this.rpcClient = new RpcClient({
      serviceBinding: options.serviceBinding,
      serviceName: "excel-worker",
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      requestIdGenerator: () =>
        `excel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  /**
   * Generate premium Excel workbook
   */
  async generatePremiumWorkbook(
    input: GeneratePremiumWorkbookInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<GeneratePremiumWorkbookOutput> {
    return this.rpcClient.call<
      "generatePremiumWorkbook",
      GeneratePremiumWorkbookInput,
      GeneratePremiumWorkbookOutput
    >("generatePremiumWorkbook", input, metadata);
  }

  /**
   * Generate adjustment Excel sheet
   */
  async generateAdjustmentSheet(
    input: GenerateAdjustmentSheetInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<GenerateAdjustmentSheetOutput> {
    return this.rpcClient.call<
      "generateAdjustmentSheet",
      GenerateAdjustmentSheetInput,
      GenerateAdjustmentSheetOutput
    >("generateAdjustmentSheet", input, metadata);
  }

  /**
   * Export generic report
   */
  async exportReport(
    input: ExportReportInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<ExportReportOutput> {
    return this.rpcClient.call<
      "exportReport",
      ExportReportInput,
      ExportReportOutput
    >("exportReport", input, metadata);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.rpcClient.healthCheck();
  }

  /**
   * Get service info
   */
  async getServiceInfo(): Promise<unknown> {
    return this.rpcClient.getServiceInfo();
  }

  /**
   * Convenience method for generating premium report
   */
  async generatePremiumReport(
    policy: GeneratePremiumWorkbookInput["policy"],
    premium: GeneratePremiumWorkbookInput["premium"],
    options?: {
      includeAdjustment?: boolean;
      policyNumber?: string;
      clientName?: string;
      generatedBy?: string;
      appVersion?: string;
      rating?: GeneratePremiumWorkbookInput["rating"];
      adjustment?: GeneratePremiumWorkbookInput["adjustment"];
      requestId?: string;
    },
  ): Promise<GeneratePremiumWorkbookOutput> {
    const input: GeneratePremiumWorkbookInput = {
      policy,
      premium,
      rating: options?.rating,
      adjustment: options?.adjustment,
      options: {
        includeAdjustment: options?.includeAdjustment ?? false,
        ...(options?.policyNumber !== undefined && {
          policyNumber: options.policyNumber,
        }),
        ...(options?.clientName !== undefined && {
          clientName: options.clientName,
        }),
        generatedBy: options?.generatedBy || "system",
        appVersion: options?.appVersion || "1.0.0",
      },
    };

    return this.generatePremiumWorkbook(input, {
      requestId: options?.requestId,
    });
  }
}

/**
 * Factory function to create Excel service client
 */
export function createExcelServiceClient(
  serviceBinding: ServiceBinding,
  options?: Omit<ExcelServiceClientOptions, "serviceBinding">,
): ExcelServiceClient {
  return new ExcelServiceClient({
    serviceBinding,
    ...options,
  });
}

/**
 * Default export
 */
export default ExcelServiceClient;
