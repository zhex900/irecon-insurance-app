/**
 * Template validation schemas for document workers
 */

import { z } from "zod";

// Template field definition
export const templateFieldSchema = z.object({
  name: z.string(),
  type: z.enum([
    "text",
    "number",
    "date",
    "boolean",
    "currency",
    "percentage",
    "select",
  ]),
  label: z.string(),
  required: z.boolean().optional().default(false),
  defaultValue: z.unknown().optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      allowedValues: z.array(z.string()).optional(),
      customMessage: z.string().optional(),
    })
    .optional(),
  display: z
    .object({
      order: z.number(),
      group: z.string().optional(),
      helpText: z.string().optional(),
      placeholder: z.string().optional(),
      width: z.number().optional(),
    })
    .optional(),
});

export type TemplateField = z.infer<typeof templateFieldSchema>;

// Template section definition
export const templateSectionSchema = z.object({
  name: z.string(),
  label: z.string(),
  fields: z.array(templateFieldSchema),
  collapsible: z.boolean().optional().default(false),
  collapsedByDefault: z.boolean().optional().default(false),
  repeatable: z.boolean().optional().default(false),
  maxRepeats: z.number().optional(),
  order: z.number(),
});

export type TemplateSection = z.infer<typeof templateSectionSchema>;

// Template definition
export const templateDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  sections: z.array(templateSectionSchema),
  metadata: z.object({
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    createdBy: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().optional().default(true),
    isPublic: z.boolean().optional().default(false),
  }),
  settings: z
    .object({
      allowMultipleInstances: z.boolean().optional().default(false),
      retentionDays: z.number().optional(),
      autoVersioning: z.boolean().optional().default(true),
      validationStrictness: z
        .enum(["strict", "moderate", "lenient"])
        .optional()
        .default("moderate"),
      defaultLocale: z.string().optional().default("en-US"),
    })
    .optional(),
});

export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;

// Template instance (data-filled template)
export const templateInstanceSchema = z.object({
  templateId: z.string(),
  version: z.string(),
  data: z.record(z.string(), z.unknown()),
  metadata: z.object({
    instanceId: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    createdBy: z.string(),
    status: z.enum(["draft", "pending", "approved", "rejected", "archived"]),
    lastModified: z.string().datetime({ offset: true }).optional(),
    lastModifiedBy: z.string().optional(),
    locale: z.string().optional().default("en-US"),
  }),
  validation: z
    .object({
      isValid: z.boolean(),
      errors: z
        .array(
          z.object({
            field: z.string(),
            error: z.string(),
            severity: z.enum(["error", "warning", "info"]),
          }),
        )
        .optional(),
      warnings: z.array(z.string()).optional(),
      validatedAt: z.string().datetime({ offset: true }),
      validatedBy: z.string(),
    })
    .optional(),
});

export type TemplateInstance = z.infer<typeof templateInstanceSchema>;

// Template validation request
export const validateTemplateRequestSchema = z.object({
  templateDefinition: templateDefinitionSchema,
  templateInstance: templateInstanceSchema,
  validationOptions: z
    .object({
      checkRequiredFields: z.boolean().optional().default(true),
      checkFieldTypes: z.boolean().optional().default(true),
      checkFieldConstraints: z.boolean().optional().default(true),
      checkBusinessRules: z.boolean().optional().default(false),
      allowPartialValidation: z.boolean().optional().default(false),
      strictMode: z.boolean().optional().default(false),
    })
    .optional(),
});

export type ValidateTemplateRequest = z.infer<
  typeof validateTemplateRequestSchema
>;

// Template validation result
export const templateValidationResultSchema = z.object({
  isValid: z.boolean(),
  summary: z.object({
    totalFields: z.number(),
    validatedFields: z.number(),
    errors: z.number(),
    warnings: z.number(),
    validationTime: z.number(),
  }),
  fieldResults: z.array(
    z.object({
      field: z.string(),
      path: z.string(),
      status: z.enum(["valid", "invalid", "warning", "skipped"]),
      messages: z
        .array(
          z.object({
            type: z.enum(["error", "warning", "info"]),
            message: z.string(),
            code: z.string().optional(),
          }),
        )
        .optional(),
      value: z.unknown().optional(),
      expectedType: z.string().optional(),
      actualType: z.string().optional(),
      constraints: z
        .object({
          min: z.number().optional(),
          max: z.number().optional(),
          pattern: z.string().optional(),
        })
        .optional(),
    }),
  ),
  businessRuleResults: z
    .array(
      z.object({
        ruleId: z.string(),
        description: z.string(),
        status: z.enum(["passed", "failed", "warning"]),
        message: z.string(),
        affectedFields: z.array(z.string()),
        severity: z.enum(["critical", "high", "medium", "low"]),
      }),
    )
    .optional(),
  recommendations: z
    .array(
      z.object({
        type: z.enum(["field", "template", "data"]),
        action: z.string(),
        reason: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        fields: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  metadata: z.object({
    templateId: z.string(),
    templateVersion: z.string(),
    validationTimestamp: z.string().datetime({ offset: true }),
    validatorId: z.string(),
    environment: z.string().optional(),
    requestId: z.string(),
  }),
});

export type TemplateValidationResult = z.infer<
  typeof templateValidationResultSchema
>;

// Template comparison request
export const compareTemplatesRequestSchema = z.object({
  sourceTemplate: templateDefinitionSchema,
  targetTemplate: templateDefinitionSchema,
  comparisonOptions: z
    .object({
      compareStructure: z.boolean().optional().default(true),
      compareFields: z.boolean().optional().default(true),
      compareValidation: z.boolean().optional().default(true),
      compareMetadata: z.boolean().optional().default(false),
      deepCompare: z.boolean().optional().default(false),
    })
    .optional(),
});

export type CompareTemplatesRequest = z.infer<
  typeof compareTemplatesRequestSchema
>;

// Template comparison result
export const compareTemplatesResultSchema = z.object({
  compatible: z.boolean(),
  changes: z.object({
    added: z.array(
      z.object({
        type: z.enum(["section", "field", "validation"]),
        name: z.string(),
        path: z.string(),
        details: z.string(),
      }),
    ),
    removed: z.array(
      z.object({
        type: z.enum(["section", "field", "validation"]),
        name: z.string(),
        path: z.string(),
        details: z.string(),
      }),
    ),
    modified: z.array(
      z.object({
        type: z.enum(["section", "field", "validation"]),
        name: z.string(),
        path: z.string(),
        changes: z.array(
          z.object({
            property: z.string(),
            oldValue: z.unknown().optional(),
            newValue: z.unknown(),
            impact: z.enum(["breaking", "non-breaking", "warning"]),
          }),
        ),
      }),
    ),
  }),
  migrationPath: z
    .object({
      canMigrate: z.boolean(),
      complexity: z.enum(["simple", "moderate", "complex"]),
      steps: z
        .array(
          z.object({
            action: z.string(),
            description: z.string(),
            resources: z.array(z.string()).optional(),
            estimatedTime: z.number().optional(),
          }),
        )
        .optional(),
      warnings: z.array(z.string()).optional(),
      errors: z.array(z.string()).optional(),
    })
    .optional(),
  summary: z.object({
    totalFields: z.number(),
    modifiedFields: z.number(),
    addedFields: z.number(),
    removedFields: z.number(),
    breakingChanges: z.number(),
    nonBreakingChanges: z.number(),
  }),
  metadata: z.object({
    sourceVersion: z.string(),
    targetVersion: z.string(),
    comparisonTimestamp: z.string().datetime({ offset: true }),
    requestId: z.string(),
  }),
});

export type CompareTemplatesResult = z.infer<
  typeof compareTemplatesResultSchema
>;

// Template migration request
export const migrateTemplateRequestSchema = z.object({
  sourceInstance: templateInstanceSchema,
  targetTemplate: templateDefinitionSchema,
  migrationOptions: z
    .object({
      preserveData: z.boolean().optional().default(true),
      fillDefaults: z.boolean().optional().default(true),
      validateAfterMigration: z.boolean().optional().default(true),
      handleConflicts: z
        .enum(["keep", "replace", "merge", "ask"])
        .optional()
        .default("merge"),
      migrationStrategy: z
        .enum(["automatic", "guided", "manual"])
        .optional()
        .default("automatic"),
    })
    .optional(),
});

export type MigrateTemplateRequest = z.infer<
  typeof migrateTemplateRequestSchema
>;

// Template migration result
export const migrateTemplateResultSchema = z.object({
  success: z.boolean(),
  migratedInstance: templateInstanceSchema,
  migrationReport: z.object({
    migratedFields: z.number(),
    partiallyMigrated: z.number(),
    failedFields: z.number(),
    defaultedFields: z.number(),
    conflicts: z.number(),
    dataLoss: z.boolean(),
    dataLossFields: z.array(z.string()).optional(),
  }),
  validationResult: templateValidationResultSchema.optional(),
  warnings: z.array(z.string()).optional(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        error: z.string(),
        severity: z.enum(["error", "warning"]),
      }),
    )
    .optional(),
  metadata: z.object({
    sourceTemplateId: z.string(),
    sourceVersion: z.string(),
    targetTemplateId: z.string(),
    targetVersion: z.string(),
    migrationTimestamp: z.string().datetime({ offset: true }),
    migrationDuration: z.number(),
    requestId: z.string(),
  }),
});

export type MigrateTemplateResult = z.infer<typeof migrateTemplateResultSchema>;
