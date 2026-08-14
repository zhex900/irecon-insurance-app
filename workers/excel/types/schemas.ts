/**
 * Zod schemas for Excel worker request validation
 * Single source of truth for all worker data structures
 */

import { z } from "zod";
import type {
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
  AdjustmentBreakdown,
} from "~/lib/types/excel-worker-types";

// Base request schema matching ExcelWorkerRequest interface
export const excelWorkerRequestSchema = z.object({
  reportType: z.enum([
    "policy",
    "client",
    "premium",
    "custom",
    "export",
    "premiumWorkbook",
  ]),
  data: z.unknown(),
  options: z
    .object({
      includeFormulas: z.boolean().optional(),
      formatCurrency: z.boolean().optional(),
      sheetName: z.string().optional(),
      title: z.string().optional(),
      includeTimestamp: z.boolean().optional(),
      premiumWorkbook: z
        .object({
          policyNumber: z.string().optional(),
          clientName: z.string().optional(),
          appVersion: z.string().optional(),
          includeAdjustment: z.boolean().optional(),
          generatedBy: z.string().optional(),
          existing: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
});

// Custom report data validation
export const customReportDataSchema = z.object({
  columns: z.array(
    z.object({
      key: z.string(),
      header: z.string(),
      width: z.number().optional(),
      type: z.enum(["text", "currency", "integer", "date"]).optional(),
    }),
  ),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
});

// Premium workbook specific data validation
export const premiumWorkbookDataSchema = z.object({
  policy: z.unknown().refine(
    (val): val is Policy => {
      return typeof val === "object" && val !== null && "policyId" in val;
    },
    { message: "Invalid policy data" },
  ),
  premium: z.unknown().refine(
    (val): val is PremiumBreakdown => {
      return (
        typeof val === "object" &&
        val !== null &&
        "contractWorksBasePremium" in val
      );
    },
    { message: "Invalid premium data" },
  ),
  rating: z
    .unknown()
    .refine(
      (val): val is RatingSnapshot | undefined => {
        return (
          val === undefined ||
          (typeof val === "object" &&
            val !== null &&
            "contractWorksAppliedRate" in val)
        );
      },
      { message: "Invalid rating data" },
    )
    .optional(),
  adjustment: z
    .unknown()
    .refine(
      (val): val is AdjustmentBreakdown | undefined => {
        return (
          val === undefined ||
          (typeof val === "object" && val !== null && "originalTurnover" in val)
        );
      },
      { message: "Invalid adjustment data" },
    )
    .optional(),
});

// Response schema
export const excelWorkerResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  excelBase64: z.string().optional(),
  size: z.number().optional(),
  generationTime: z.number().optional(),
});

// Signed request schema for authenticated worker calls
export const signedWorkerRequestSchema = z.object({
  payload: excelWorkerRequestSchema,
  signature: z.string(),
  timestamp: z.number(),
  serviceName: z.string(),
});

// Health check response schema
export const healthResponseSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  version: z.string(),
  timestamp: z.string(),
});

// Info endpoint response schema
export const infoResponseSchema = z.object({
  service: z.string(),
  version: z.string(),
  endpoints: z.array(z.string()),
  capabilities: z.array(z.string()),
});

// Type exports derived from schemas (single source of truth)
export type ExcelWorkerRequest = z.infer<typeof excelWorkerRequestSchema>;
export type ExcelWorkerResponse = z.infer<typeof excelWorkerResponseSchema>;
export type SignedWorkerRequest = z.infer<typeof signedWorkerRequestSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type InfoResponse = z.infer<typeof infoResponseSchema>;
