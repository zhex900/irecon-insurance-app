// Document worker Zod schemas
import { z } from "zod";

/**
 * PDF render request schema
 */
export const pdfRenderRequestSchema = z.object({
  templateKey: z.string(),
  policy: z.any(), // Using any for complex Policy type from app
  mergeInputs: z.record(z.string(), z.any()), // String keys, any type values
  template: z.optional(z.any()), // Using any for DocumentTemplate
  wordingCatalogue: z.array(z.any()).optional(),
  brokerFeeLines: z.array(z.any()).optional(), // Using any for BrokerFeeLineInput type
  requestId: z.string(),
});

/**
 * Signed request schema for service-to-service communication
 */
export const signedDocumentRequestSchema = z.object({
  payload: pdfRenderRequestSchema,
  signature: z.string(),
  timestamp: z.number(),
  serviceName: z.string(),
});

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  error: z.enum([
    "invalid_request",
    "payload_too_large",
    "render_failed",
    "method_not_allowed",
    "not_found",
    "unauthorized",
  ]),
  requestId: z.string().optional(),
});

/**
 * Health check response schema
 */
export const healthCheckSchema = z.object({
  status: z.enum(["ok", "error"]),
  version: z.string().optional(),
  timestamp: z.string(),
});

// Export types derived from schemas
export type PdfRenderRequest = z.infer<typeof pdfRenderRequestSchema>;
export type SignedDocumentRequest = z.infer<typeof signedDocumentRequestSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type HealthCheckResponse = z.infer<typeof healthCheckSchema>;

// Re-export constants that were previously imported from app
export const PDF_RENDER_PATH = "/render";
export const MAX_PDF_RENDER_REQUEST_BYTES = 10 * 1024 * 1024; // 10MB
