/**
 * Type-safe Document service client
 */

import { RpcClient } from "../rpc/RpcClient";
import type { ServiceBinding } from "../rpc/types";
import type {
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
  CompareTemplatesRequest,
  CompareTemplatesResult,
  MigrateTemplateRequest,
  MigrateTemplateResult,
} from "../schemas/documents";

export interface DocumentServiceClientOptions {
  /** Service binding instance */
  serviceBinding: ServiceBinding;
  /** Base URL for the service */
  baseUrl?: string;
  /** Default timeout for requests (ms) */
  timeoutMs?: number;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Whether to enable telemetry */
  enableTelemetry?: boolean;
}

export class DocumentServiceClient {
  private rpcClient: RpcClient;

  constructor(options: DocumentServiceClientOptions) {
    this.rpcClient = new RpcClient({
      serviceBinding: options.serviceBinding,
      serviceName: "documents-worker",
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      requestIdGenerator: () =>
        `docs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  /**
   * Generate policy PDF document
   */
  async generatePolicyPdf(
    input: GeneratePolicyPdfInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<GeneratePolicyPdfOutput> {
    return this.rpcClient.call<
      "generatePolicyPdf",
      GeneratePolicyPdfInput,
      GeneratePolicyPdfOutput
    >("generatePolicyPdf", input, metadata);
  }

  /**
   * Generate certificate of insurance PDF
   */
  async generateCertificate(
    input: GenerateCertificateInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<GenerateCertificateOutput> {
    return this.rpcClient.call<
      "generateCertificate",
      GenerateCertificateInput,
      GenerateCertificateOutput
    >("generateCertificate", input, metadata);
  }

  /**
   * Generate endorsement PDF document
   */
  async generateEndorsement(
    input: GenerateEndorsementInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<GenerateEndorsementOutput> {
    return this.rpcClient.call<
      "generateEndorsement",
      GenerateEndorsementInput,
      GenerateEndorsementOutput
    >("generateEndorsement", input, metadata);
  }

  /**
   * Validate document template
   */
  async validateTemplate(
    input: ValidateTemplateInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<ValidateTemplateOutput> {
    return this.rpcClient.call<
      "validateTemplate",
      ValidateTemplateInput,
      ValidateTemplateOutput
    >("validateTemplate", input, metadata);
  }

  /**
   * Generate multiple PDFs in bulk
   */
  async generateBulkPdfs(
    input: GenerateBulkPdfsInput,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<GenerateBulkPdfsOutput> {
    return this.rpcClient.call<
      "generateBulkPdfs",
      GenerateBulkPdfsInput,
      GenerateBulkPdfsOutput
    >("generateBulkPdfs", input, metadata);
  }

  /**
   * Compare two templates
   */
  async compareTemplates(
    input: CompareTemplatesRequest,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<CompareTemplatesResult> {
    return this.rpcClient.call<
      "compareTemplates",
      CompareTemplatesRequest,
      CompareTemplatesResult
    >("compareTemplates", input, metadata);
  }

  /**
   * Migrate template instance to new template version
   */
  async migrateTemplate(
    input: MigrateTemplateRequest,
    metadata?: {
      requestId?: string;
      correlationId?: string;
      traceId?: string;
      timeoutMs?: number;
    },
  ): Promise<MigrateTemplateResult> {
    return this.rpcClient.call<
      "migrateTemplate",
      MigrateTemplateRequest,
      MigrateTemplateResult
    >("migrateTemplate", input, metadata);
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
   * Convenience method for generating simple policy document
   */
  async generateSimplePolicyPdf(
    policy: GeneratePolicyPdfInput["policy"],
    policyData: GeneratePolicyPdfInput["policyData"],
    options?: {
      templateId?: string;
      includeWatermark?: boolean;
      includeSignatures?: boolean;
      pageSize?: "A4" | "Letter" | "Legal";
      orientation?: "portrait" | "landscape";
      quality?: "low" | "medium" | "high";
      generatedBy?: string;
      requestId?: string;
    },
  ): Promise<GeneratePolicyPdfOutput> {
    const input: GeneratePolicyPdfInput = {
      policy,
      policyData,
      options: {
        templateId: options?.templateId || "default-policy",
        includeWatermark: options?.includeWatermark ?? false,
        includeSignatures: options?.includeSignatures ?? false,
        includeCoverPage: true,
        includeTableOfContents: false,
        pageSize: options?.pageSize ?? "A4",
        orientation: options?.orientation ?? "portrait",
        quality: options?.quality ?? "high",
        includeMetadata: true,
        generatedBy: options?.generatedBy || "system",
        appVersion: "1.0.0",
      },
    };

    return this.generatePolicyPdf(input, {
      requestId: options?.requestId,
    });
  }

  /**
   * Convenience method for bulk generation of policy documents
   */
  async bulkGeneratePolicyPdfs(
    policies: Array<{
      policy: GeneratePolicyPdfInput["policy"];
      policyData: GeneratePolicyPdfInput["policyData"];
      options?: GeneratePolicyPdfInput["options"];
    }>,
    options?: {
      concurrentLimit?: number;
      timeoutPerDocument?: number;
      zipOutput?: boolean;
      requestId?: string;
    },
  ): Promise<GenerateBulkPdfsOutput> {
    const input: GenerateBulkPdfsInput = {
      documents: policies.map((item) => ({
        type: "policy" as const,
        data: {
          policy: item.policy,
          policyData: item.policyData,
          options: item.options,
        },
      })),
      options: {
        concurrentLimit: options?.concurrentLimit ?? 5,
        timeoutPerDocument: options?.timeoutPerDocument ?? 30000,
        stopOnError: false,
        includeSummary: true,
        zipOutput: options?.zipOutput ?? false,
      },
    };

    return this.generateBulkPdfs(input, {
      requestId: options?.requestId,
    });
  }

  /**
   * Validate template with custom validation rules
   */
  async validateTemplateWithCustomRules(
    templateId: string,
    templateContent: unknown,
    validationRules?: {
      requiredFields?: string[];
      fieldTypes?: Record<string, "string" | "number" | "date" | "boolean">;
      fieldConstraints?: Record<
        string,
        {
          min?: number;
          max?: number;
          pattern?: string;
          required?: boolean;
        }
      >;
      schemaVersion?: string;
    },
    metadata?: {
      requestId?: string;
      correlationId?: string;
    },
  ): Promise<ValidateTemplateOutput> {
    const input: ValidateTemplateInput = {
      templateId,
      templateContent,
      validationRules,
    };

    return this.validateTemplate(input, metadata);
  }
}

/**
 * Factory function to create Document service client
 */
export function createDocumentServiceClient(
  serviceBinding: ServiceBinding,
  options?: Omit<DocumentServiceClientOptions, "serviceBinding">,
): DocumentServiceClient {
  return new DocumentServiceClient({
    serviceBinding,
    ...options,
  });
}

/**
 * Default export
 */
export default DocumentServiceClient;
