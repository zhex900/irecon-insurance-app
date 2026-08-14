/**
 * Shared TypeScript types index
 * All types are derived from Zod schemas to ensure single source of truth
 */

// Import types from files
import type { ServiceBinding } from "./rpc-types";

// Re-export from type files
export * from "./excel-types";
export * from "./document-types";
export * from "./rpc-types";

// Common utility types
export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type XOR<T, U> = T | U extends object
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;

// Promise utility types
export type AsyncResult<T, E = Error> = Promise<
  { success: true; data: T } | { success: false; error: E }
>;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

// Environment types for workers
export interface WorkerEnvironment {
  // Service bindings
  EXCEL_SERVICE?: ServiceBinding;
  DOCUMENTS_SERVICE?: ServiceBinding;

  // Storage bindings (Cloudflare Workers types)
  KV_NAMESPACE?: unknown; // KVNamespace
  R2_BUCKET?: unknown; // R2Bucket

  // Database bindings (Cloudflare Workers types)
  DB?: unknown; // D1Database

  // Configuration
  ENVIRONMENT: "development" | "staging" | "production";
  SENTRY_DSN?: string;
  LOG_LEVEL?: "debug" | "info" | "warn" | "error";

  // Security
  SHARED_SECRET?: string;
  JWT_SECRET?: string;
}

// Worker context type
export interface WorkerContext {
  env: WorkerEnvironment;
  ctx: unknown; // ExecutionContext
  request: Request;
  waitUntil(promise: Promise<unknown>): void;
}

// Request handler type
export type WorkerRequestHandler = (
  request: Request,
  env: WorkerEnvironment,
  ctx: unknown, // ExecutionContext
) => Promise<Response> | Response;

// RPC handler type
export type RpcHandler<
  S extends Record<string, (...args: unknown[]) => unknown>,
> = {
  [K in keyof S]: (
    input: Parameters<S[K]>[0],
    metadata?: Parameters<S[K]>[1],
  ) => ReturnType<S[K]>;
};

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

// Transformation function type
export type Transformer<TInput, TOutput> = (
  input: TInput,
  context?: Record<string, unknown>,
) => TOutput | Promise<TOutput>;

// Cache entry type
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  metadata?: {
    etag?: string;
    lastModified?: string;
    size?: number;
  };
}

// Performance metrics type
export interface PerformanceMetrics {
  count: number;
  average: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  total: number;
}

// Monitoring alert type
export interface MonitoringAlert {
  id: string;
  type: "error_rate" | "latency" | "throughput" | "availability";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  metric: number;
  threshold: number;
  timestamp: string;
  service: string;
  method?: string;
  alertState: "firing" | "resolved";
  resolvedAt?: string;
}
