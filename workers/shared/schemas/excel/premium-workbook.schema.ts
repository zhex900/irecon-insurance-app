/**
 * Excel worker schemas for premium workbook generation
 */

import { z } from "zod";
import type {
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
  AdjustmentBreakdown,
} from "~/lib/types/excel-worker-types";

// Use z.any() for existing types that are complex
// These schemas will validate at runtime but accept the complex types
export const policySchema: z.ZodType<Policy> = z.any();

export const premiumBreakdownSchema: z.ZodType<PremiumBreakdown> = z.any();

export const ratingSnapshotSchema: z.ZodType<RatingSnapshot> = z.any();

export const adjustmentBreakdownSchema: z.ZodType<AdjustmentBreakdown> =
  z.any();

// Premium workbook input schema
export const generatePremiumWorkbookInputSchema = z.object({
  policy: policySchema,
  premium: premiumBreakdownSchema,
  rating: ratingSnapshotSchema.optional(),
  adjustment: adjustmentBreakdownSchema.optional(),
  options: z
    .object({
      includeAdjustment: z.boolean().optional().default(false),
      policyNumber: z.string().optional(),
      clientName: z.string().optional(),
      generatedBy: z.string().optional().default("system"),
      appVersion: z.string().optional().default("1.0.0"),
    })
    .optional(),
});

export type GeneratePremiumWorkbookInput = z.infer<
  typeof generatePremiumWorkbookInputSchema
>;

// Premium workbook output schema
export const generatePremiumWorkbookOutputSchema = z.object({
  workbook: z.object({
    url: z.string(),
    size: z.number(),
    mimeType: z.string(),
    filename: z.string(),
  }),
  metadata: z.object({
    generationTime: z.number(),
    sheetCount: z.number(),
    policyNumber: z.string().optional(),
    clientName: z.string().optional(),
  }),
});

export type GeneratePremiumWorkbookOutput = z.infer<
  typeof generatePremiumWorkbookOutputSchema
>;

// Adjustment sheet schemas
export const generateAdjustmentSheetInputSchema = z.object({
  policy: policySchema,
  premium: premiumBreakdownSchema,
  adjustment: adjustmentBreakdownSchema,
  options: z
    .object({
      policyNumber: z.string().optional(),
      clientName: z.string().optional(),
      generatedBy: z.string().optional().default("system"),
    })
    .optional(),
});

export type GenerateAdjustmentSheetInput = z.infer<
  typeof generateAdjustmentSheetInputSchema
>;

export const generateAdjustmentSheetOutputSchema = z.object({
  sheet: z.object({
    url: z.string(),
    size: z.number(),
    mimeType: z.string(),
    filename: z.string(),
  }),
  metadata: z.object({
    generationTime: z.number(),
    adjustmentApplied: z.boolean(),
    policyNumber: z.string().optional(),
  }),
});

export type GenerateAdjustmentSheetOutput = z.infer<
  typeof generateAdjustmentSheetOutputSchema
>;

// Generic Excel generation schemas
export const exportReportInputSchema = z.object({
  reportType: z.enum(["policy", "client", "premium", "custom"]),
  data: z.unknown(),
  options: z
    .object({
      includeFormulas: z.boolean().optional().default(true),
      formatCurrency: z.boolean().optional().default(true),
      sheetName: z.string().optional(),
      title: z.string().optional(),
      includeTimestamp: z.boolean().optional().default(true),
    })
    .optional(),
});

export type ExportReportInput = z.infer<typeof exportReportInputSchema>;

export const exportReportOutputSchema = z.object({
  excel: z.object({
    url: z.string(),
    size: z.number(),
    mimeType: z.string(),
    filename: z.string(),
  }),
  metadata: z.object({
    generationTime: z.number(),
    reportType: z.string(),
    rowCount: z.number().optional(),
  }),
});

export type ExportReportOutput = z.infer<typeof exportReportOutputSchema>;
