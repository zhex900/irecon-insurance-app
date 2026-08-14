/**
 * RPC type definitions
 */

// Service binding interface compatible with Cloudflare Workers
export interface ServiceBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// Base request interface for all RPC calls
export interface BaseRpcRequest {
  method: string;
  metadata?: {
    requestId?: string;
    correlationId?: string;
    traceId?: string;
    source?: string;
    timestamp?: number;
    timeoutMs?: number;
  };
}

// Base response interface for all RPC calls
export interface BaseRpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    requestId?: string;
    timestamp?: number;
    processingTimeMs?: number;
  };
}

// RPC method definition
export interface RpcMethodDefinition<TInput, TOutput> {
  name: string;
  description?: string;
  inputSchema?: unknown; // Zod schema reference
  outputSchema?: unknown; // Zod schema reference
}

// RPC service interface
export interface RpcService {
  [method: string]: (input: any, metadata?: any) => Promise<any>;
}

// RPC service definition
export interface RpcServiceDefinition {
  serviceName: string;
  version: string;
  methods: Record<string, RpcMethodDefinition<any, any>>;
}

// Excel worker RPC service interface
export interface ExcelRpcService extends RpcService {
  generatePremiumWorkbook: (
    input: import("../schemas/excel/premium-workbook.schema").GeneratePremiumWorkbookInput,
    metadata?: BaseRpcRequest["metadata"],
  ) => Promise<
    import("../schemas/excel/premium-workbook.schema").GeneratePremiumWorkbookOutput
  >;

  generateAdjustmentSheet: (
    input: import("../schemas/excel/premium-workbook.schema").GenerateAdjustmentSheetInput,
    metadata?: BaseRpcRequest["metadata"],
  ) => Promise<
    import("../schemas/excel/premium-workbook.schema").GenerateAdjustmentSheetOutput
  >;

  exportReport: (
    input: import("../schemas/excel/premium-workbook.schema").ExportReportInput,
    metadata?: BaseRpcRequest["metadata"],
  ) => Promise<
    import("../schemas/excel/premium-workbook.schema").ExportReportOutput
  >;
}

// Document worker RPC service interface
export interface DocumentRpcService extends RpcService {
  generatePolicyPdf: (
    input: unknown, // TODO: Define PDF generation schemas
    metadata?: BaseRpcRequest["metadata"],
  ) => Promise<unknown>;

  validateDocumentTemplate: (
    input: unknown, // TODO: Define template validation schemas
    metadata?: BaseRpcRequest["metadata"],
  ) => Promise<unknown>;
}

// Union type for all RPC services
export type KnownRpcServices = ExcelRpcService | DocumentRpcService;

// RPC handler function type
export type RpcHandler<TSchema, TService> = (
  service: TService,
  input: any,
  metadata?: BaseRpcRequest["metadata"],
) => Promise<BaseRpcResponse>;

// RPC middleware function type
export type RpcMiddleware = (
  next: (input: any, metadata?: any) => Promise<any>,
) => (input: any, metadata?: any) => Promise<any>;

// Telemetry types
export interface RpcTelemetry {
  service: string;
  method: string;
  requestId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: {
    code: string;
    message: string;
  };
  metadata?: Record<string, any>;
}

// Configuration types
export interface RpcConfiguration {
  defaultTimeoutMs: number;
  maxRetries: number;
  enableTelemetry: boolean;
  telemetrySampleRate: number;
  enableValidation: boolean;
  validationStrict: boolean;
}
