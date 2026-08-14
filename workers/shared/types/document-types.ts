/**
 * Document worker TypeScript interfaces derived from Zod schemas
 * All types are inferred from shared schemas to ensure single source of truth
 */

// Re-export types from schemas
import type {
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
} from "../schemas/documents";

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
};

// RPC service interface for Document worker
export interface DocumentRpcService {
  /**
   * Generate a policy PDF document
   */
  generatePolicyPdf(
    input: GeneratePolicyPdfInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<GeneratePolicyPdfOutput>;

  /**
   * Generate a certificate of insurance PDF
   */
  generateCertificate(
    input: GenerateCertificateInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<GenerateCertificateOutput>;

  /**
   * Generate an endorsement PDF document
   */
  generateEndorsement(
    input: GenerateEndorsementInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<GenerateEndorsementOutput>;

  /**
   * Validate a document template
   */
  validateTemplate(
    input: ValidateTemplateInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<ValidateTemplateOutput>;

  /**
   * Generate multiple PDFs in bulk
   */
  generateBulkPdfs(
    input: GenerateBulkPdfsInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<GenerateBulkPdfsOutput>;

  /**
   * Compare two templates
   */
  compareTemplates(
    input: CompareTemplatesRequest,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<CompareTemplatesResult>;

  /**
   * Migrate a template instance to a new template version
   */
  migrateTemplate(
    input: MigrateTemplateRequest,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      timeoutMs?: number;
    },
  ): Promise<MigrateTemplateResult>;

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

// Document client configuration
export interface DocumentClientConfig {
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

// PDF document interface
export interface PdfDocument {
  id: string;
  type: "policy" | "certificate" | "endorsement" | "other";
  url: string;
  filename: string;
  size: number;
  pageCount: number;
  mimeType: string;
  hash?: string;
  metadata: {
    generatedAt: string;
    generatedBy: string;
    policyNumber?: string;
    insuredName?: string;
    templateVersion: string;
    quality: string;
  };
}

// Template management interface
export interface TemplateManager {
  /**
   * Register a new template
   */
  registerTemplate(template: TemplateDefinition): Promise<{
    success: boolean;
    templateId: string;
    version: string;
  }>;

  /**
   * Get template by ID and version
   */
  getTemplate(
    templateId: string,
    version?: string,
  ): Promise<TemplateDefinition | null>;

  /**
   * List all templates
   */
  listTemplates(options?: {
    category?: string;
    tags?: string[];
    isActive?: boolean;
    isPublic?: boolean;
  }): Promise<TemplateDefinition[]>;

  /**
   * Update template
   */
  updateTemplate(
    templateId: string,
    updates: Partial<TemplateDefinition>,
  ): Promise<{
    success: boolean;
    newVersion: string;
    changes: string[];
  }>;

  /**
   * Deactivate template
   */
  deactivateTemplate(templateId: string): Promise<{
    success: boolean;
    deactivatedAt: string;
  }>;

  /**
   * Archive template
   */
  archiveTemplate(
    templateId: string,
    version: string,
  ): Promise<{
    success: boolean;
    archivedAt: string;
  }>;
}

// Bulk generation job interface
export interface BulkGenerationJob {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  totalDocuments: number;
  processedDocuments: number;
  successfulDocuments: number;
  failedDocuments: number;
  startTime?: string;
  endTime?: string;
  results?: Array<{
    documentId: string;
    type: string;
    status: "success" | "failed";
    document?: PdfDocument;
    error?: {
      code: string;
      message: string;
      details?: unknown;
    };
  }>;
  options?: {
    concurrentLimit: number;
    timeoutPerDocument: number;
    stopOnError: boolean;
    includeSummary: boolean;
    zipOutput: boolean;
  };
}

// Validation options interface
export interface ValidationOptions {
  /**
   * Whether to check required fields
   */
  checkRequiredFields?: boolean;

  /**
   * Whether to check field types
   */
  checkFieldTypes?: boolean;

  /**
   * Whether to check field constraints
   */
  checkFieldConstraints?: boolean;

  /**
   * Whether to check business rules
   */
  checkBusinessRules?: boolean;

  /**
   * Whether to allow partial validation
   */
  allowPartialValidation?: boolean;

  /**
   * Whether to use strict mode
   */
  strictMode?: boolean;

  /**
   * Custom validation rules
   */
  customRules?: Array<{
    id: string;
    description: string;
    condition: (data: unknown) => boolean;
    errorMessage: string;
    severity: "error" | "warning";
  }>;
}

// Migration strategy options
export interface MigrationStrategyOptions {
  /**
   * Whether to preserve existing data
   */
  preserveData?: boolean;

  /**
   * Whether to fill missing fields with defaults
   */
  fillDefaults?: boolean;

  /**
   * Whether to validate after migration
   */
  validateAfterMigration?: boolean;

  /**
   * How to handle conflicts
   */
  handleConflicts?: "keep" | "replace" | "merge" | "ask";

  /**
   * Migration strategy
   */
  migrationStrategy?: "automatic" | "guided" | "manual";

  /**
   * Custom field mappings
   */
  fieldMappings?: Array<{
    sourceField: string;
    targetField: string;
    transform?: (value: unknown) => unknown;
    defaultValue?: unknown;
    required?: boolean;
  }>;

  /**
   * Whether to log migration details
   */
  logMigrationDetails?: boolean;
}

// Export interface for client usage
export interface DocumentGenerationResult {
  success: boolean;
  document?: PdfDocument;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: {
    generationId: string;
    templateId: string;
    templateVersion: string;
    generatedAt: string;
    generatedBy: string;
    processingTime: number;
    quality: string;
  };
  warnings?: string[];
}
