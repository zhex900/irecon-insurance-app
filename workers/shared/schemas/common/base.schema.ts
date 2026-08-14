/**
 * Base RPC schemas shared across all workers
 */

import { z } from "zod";

// Base metadata for RPC calls
export const rpcMetadataSchema = z.object({
  requestId: z.string(),
  timestamp: z.number(),
  timeoutMs: z.number().optional(),
  source: z.string().optional(),
  correlationId: z.string().optional(),
});

export type RpcMetadata = z.infer<typeof rpcMetadataSchema>;

// Standard RPC response
export const rpcResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
  metadata: rpcMetadataSchema.partial(),
});

export type RpcResponse<T = unknown> = z.infer<typeof rpcResponseSchema> & {
  data?: T;
};

// Standard RPC error codes
export const RPC_ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type RpcErrorCode =
  (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

// Health check schemas
export const healthCheckSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  version: z.string(),
  timestamp: z.string().datetime({ offset: true }),
  uptime: z.number().optional(),
  checks: z
    .record(
      z.string(),
      z.object({
        status: z.enum(["healthy", "unhealthy"]),
        latencyMs: z.number().optional(),
        message: z.string().optional(),
      }),
    )
    .optional(),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;

// Service info schemas
export const serviceInfoSchema = z.object({
  service: z.string(),
  version: z.string(),
  environment: z.string().optional(),
  capabilities: z.array(z.string()),
  endpoints: z.array(z.string()),
  uptime: z.number().optional(),
});

export type ServiceInfo = z.infer<typeof serviceInfoSchema>;
