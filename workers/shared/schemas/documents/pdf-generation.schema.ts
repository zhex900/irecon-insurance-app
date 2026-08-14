/**
 * Document worker schemas for PDF generation
 */

import { z } from "zod";
import type { Policy } from "../../../../app/lib/types/excel-worker-types";

// PDF generation options
export const pdfGenerationOptionsSchema = z.object({
  templateId: z.string(),
  includeWatermark: z.boolean().optional().default(false),
  includeSignatures: z.boolean().optional().default(false),
  includeCoverPage: z.boolean().optional().default(true),
  includeTableOfContents: z.boolean().optional().default(false),
  pageSize: z.enum(["A4", "Letter", "Legal"]).optional().default("A4"),
  orientation: z.enum(["portrait", "landscape"]).optional().default("portrait"),
  margin: z
    .object({
      top: z.number().optional().default(20),
      right: z.number().optional().default(20),
      bottom: z.number().optional().default(20),
      left: z.number().optional().default(20),
    })
    .optional(),
  quality: z.enum(["low", "medium", "high"]).optional().default("high"),
  includeMetadata: z.boolean().optional().default(true),
  generatedBy: z.string().optional().default("system"),
  appVersion: z.string().optional().default("1.0.0"),
});

export type PdfGenerationOptions = z.infer<typeof pdfGenerationOptionsSchema>;

// Policy document input schema
export const generatePolicyPdfInputSchema = z.object({
  policy: z.custom<Policy>(),
  policyData: z.object({
    policyNumber: z.string(),
    insuredName: z.string(),
    inceptionDate: z.string().datetime(),
    expiryDate: z.string().datetime(),
    premiumAmount: z.number(),
    currency: z.string().optional().default("USD"),
    coverageDetails: z.record(z.unknown()),
    endorsements: z
      .array(
        z.object({
          id: z.string(),
          description: z.string(),
          effectiveDate: z.string().datetime(),
          additionalPremium: z.number().optional(),
        }),
      )
      .optional(),
    termsAndConditions: z.array(z.string()).optional(),
  }),
  options: pdfGenerationOptionsSchema.optional(),
});

export type GeneratePolicyPdfInput = z.infer<
  typeof generatePolicyPdfInputSchema
>;

// Policy document output schema
export const generatePolicyPdfOutputSchema = z.object({
  document: z.object({
    url: z.string(),
    size: z.number(),
    mimeType: z.string(),
    filename: z.string(),
    hash: z.string().optional(),
    pageCount: z.number(),
  }),
  metadata: z.object({
    generationTime: z.number(),
    templateVersion: z.string(),
    policyNumber: z.string(),
    insuredName: z.string(),
    documentType: z.string().optional().default("policy"),
    quality: z.string(),
    pageSize: z.string(),
    orientation: z.string(),
  }),
});

export type GeneratePolicyPdfOutput = z.infer<
  typeof generatePolicyPdfOutputSchema
>;

// Certificate of insurance input schema
export const generateCertificateInputSchema = z.object({
  policy: z.custom<Policy>(),
  certificateData: z.object({
    certificateNumber: z.string(),
    holderName: z.string(),
    holderAddress: z.string(),
    effectiveDate: z.string().datetime(),
    expiryDate: z.string().datetime(),
    coverages: z.array(
      z.object({
        coverageType: z.string(),
        limit: z.string(),
        deductible: z.string().optional(),
        notes: z.string().optional(),
      }),
    ),
    additionalInsureds: z
      .array(
        z.object({
          name: z.string(),
          address: z.string().optional(),
        }),
      )
      .optional(),
    specialConditions: z.array(z.string()).optional(),
  }),
  options: pdfGenerationOptionsSchema.optional(),
});

export type GenerateCertificateInput = z.infer<
  typeof generateCertificateInputSchema
>;

// Certificate of insurance output schema
export const generateCertificateOutputSchema = z.object({
  document: z.object({
    url: z.string(),
    size: z.number(),
    mimeType: z.string(),
    filename: z.string(),
    hash: z.string().optional(),
    pageCount: z.number(),
  }),
  metadata: z.object({
    generationTime: z.number(),
    certificateNumber: z.string(),
    holderName: z.string(),
    policyNumber: z.string(),
    documentType: z.string().optional().default("certificate"),
  }),
});

export type GenerateCertificateOutput = z.infer<
  typeof generateCertificateOutputSchema
>;

// Endorsement document input schema
export const generateEndorsementInputSchema = z.object({
  policy: z.custom<Policy>(),
  endorsementData: z.object({
    endorsementNumber: z.string(),
    description: z.string(),
    effectiveDate: z.string().datetime(),
    changes: z.array(
      z.object({
        field: z.string(),
        oldValue: z.string().optional(),
        newValue: z.string(),
      }),
    ),
    premiumImpact: z
      .object({
        additionalPremium: z.number().optional(),
        returnPremium: z.number().optional(),
        netChange: z.number(),
      })
      .optional(),
    additionalConditions: z.array(z.string()).optional(),
  }),
  options: pdfGenerationOptionsSchema.optional(),
});

export type GenerateEndorsementInput = z.infer<
  typeof generateEndorsementInputSchema
>;

// Endorsement document output schema
export const generateEndorsementOutputSchema = z.object({
  document: z.object({
    url: z.string(),
    size: z.number(),
    mimeType: z.string(),
    filename: z.string(),
    hash: z.string().optional(),
    pageCount: z.number(),
  }),
  metadata: z.object({
    generationTime: z.number(),
    endorsementNumber: z.string(),
    policyNumber: z.string(),
    documentType: z.string().optional().default("endorsement"),
    premiumImpact: z
      .object({
        additionalPremium: z.number().optional(),
        returnPremium: z.number().optional(),
        netChange: z.number(),
      })
      .optional(),
  }),
});

export type GenerateEndorsementOutput = z.infer<
  typeof generateEndorsementOutputSchema
>;

// Template validation input schema
export const validateTemplateInputSchema = z.object({
  templateId: z.string(),
  templateContent: z.unknown(),
  validationRules: z
    .object({
      requiredFields: z.array(z.string()).optional(),
      fieldTypes: z
        .record(z.enum(["string", "number", "date", "boolean"]))
        .optional(),
      fieldConstraints: z
        .record(
          z.object({
            min: z.number().optional(),
            max: z.number().optional(),
            pattern: z.string().optional(),
            required: z.boolean().optional(),
          }),
        )
        .optional(),
      schemaVersion: z.string().optional(),
    })
    .optional(),
});

export type ValidateTemplateInput = z.infer<typeof validateTemplateInputSchema>;

// Template validation output schema
export const validateTemplateOutputSchema = z.object({
  isValid: z.boolean(),
  validationErrors: z
    .array(
      z.object({
        field: z.string(),
        error: z.string(),
        severity: z.enum(["error", "warning", "info"]),
      }),
    )
    .optional(),
  warnings: z.array(z.string()).optional(),
  schemaCompatibility: z
    .object({
      compatible: z.boolean(),
      missingFields: z.array(z.string()).optional(),
      extraFields: z.array(z.string()).optional(),
      typeMismatches: z
        .array(
          z.object({
            field: z.string(),
            expectedType: z.string(),
            actualType: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  metadata: z.object({
    templateId: z.string(),
    validationTime: z.number(),
    schemaVersion: z.string().optional(),
    totalFields: z.number().optional(),
  }),
});

export type ValidateTemplateOutput = z.infer<
  typeof validateTemplateOutputSchema
>;

// Bulk PDF generation input schema
export const generateBulkPdfsInputSchema = z.object({
  documents: z.array(
    z.union([
      z.object({
        type: z.literal("policy"),
        data: generatePolicyPdfInputSchema,
      }),
      z.object({
        type: z.literal("certificate"),
        data: generateCertificateInputSchema,
      }),
      z.object({
        type: z.literal("endorsement"),
        data: generateEndorsementInputSchema,
      }),
    ]),
  ),
  options: z
    .object({
      concurrentLimit: z.number().optional().default(5),
      timeoutPerDocument: z.number().optional().default(30000),
      stopOnError: z.boolean().optional().default(false),
      includeSummary: z.boolean().optional().default(true),
      zipOutput: z.boolean().optional().default(false),
    })
    .optional(),
});

export type GenerateBulkPdfsInput = z.infer<typeof generateBulkPdfsInputSchema>;

// Bulk PDF generation output schema
export const generateBulkPdfsOutputSchema = z.object({
  results: z.array(
    z.object({
      documentId: z.string(),
      type: z.enum(["policy", "certificate", "endorsement"]),
      status: z.enum(["success", "failed"]),
      document: z
        .object({
          url: z.string(),
          size: z.number(),
          filename: z.string(),
        })
        .optional(),
      error: z
        .object({
          code: z.string(),
          message: z.string(),
          details: z.unknown().optional(),
        })
        .optional(),
      metadata: z.object({
        generationTime: z.number(),
        attempts: z.number().optional(),
      }),
    }),
  ),
  summary: z.object({
    totalDocuments: z.number(),
    successful: z.number(),
    failed: z.number(),
    totalTime: z.number(),
    averageTimePerDocument: z.number(),
    zipUrl: z.string().optional(),
  }),
});

export type GenerateBulkPdfsOutput = z.infer<
  typeof generateBulkPdfsOutputSchema
>;
