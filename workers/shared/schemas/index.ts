/**
 * Shared schemas index
 */

// Re-export all schemas
export * from "./common";
export * from "./excel";
export * from "./documents";

// Common types
export type {
  RpcMetadata,
  RpcResponse,
  RpcErrorCode,
  HealthCheck,
  ServiceInfo,
} from "./common";

// Excel types
export type {
  GeneratePremiumWorkbookInput,
  GeneratePremiumWorkbookOutput,
  GenerateAdjustmentSheetInput,
  GenerateAdjustmentSheetOutput,
  ExportReportInput,
  ExportReportOutput,
} from "./excel";

// Document types
export type {
  PdfGenerationOptions,
  GeneratePolicyPdfInput,
  GeneratePolicyPdfOutput,
  GenerateCertificateInput,
  GenerateCertificateOutput,
  GenerateEndorsementInput,
  GenerateEndorsementOutput,
  ValidateTemplateInput,
  ValidateTemplateOutput,
  GenerateBulkPdfsInput,
  GenerateBulkPdfsOutput,
  TemplateField,
  TemplateSection,
  TemplateDefinition,
  TemplateInstance,
  ValidateTemplateRequest,
  TemplateValidationResult,
  CompareTemplatesRequest,
  CompareTemplatesResult,
  MigrateTemplateRequest,
  MigrateTemplateResult,
} from "./documents";
