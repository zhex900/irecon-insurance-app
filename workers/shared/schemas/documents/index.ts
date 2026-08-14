/**
 * Document schemas export
 */

export * from "./pdf-generation.schema";
export * from "./template-validation.schema";

// PDF generation types
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
} from "./pdf-generation.schema";

// Template validation types
export type {
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
} from "./template-validation.schema";
