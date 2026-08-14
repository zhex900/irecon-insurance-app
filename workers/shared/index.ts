/**
 * Shared Worker Infrastructure
 *
 * Complete RPC infrastructure for service-to-service communication
 * Zero public endpoints, full Zod validation, consistent patterns
 */

// Export RPC infrastructure
export * from "./rpc/RpcClient";
export * from "./rpc/errors";
export {
  RpcTelemetryCollector,
  TelemetryRpcClient,
  withTelemetry,
  globalTelemetry,
  PerformanceMetricsCollector,
} from "./rpc/telemetry";
// Note: types are exported separately to avoid conflicts

// Export shared schemas
export * from "./schemas";

// Export shared types - selective exports to avoid conflicts
export type {
  ServiceBinding,
  RpcRequest,
  RpcResponse,
  RpcErrorInterface,
  WorkerEnvironment,
  WorkerRequestHandler,
  ValidationResult,
  ExcelRpcService,
  GeneratePremiumWorkbookInput,
  GeneratePremiumWorkbookOutput,
  ExcelServiceClientOptions,
  DocumentRpcService,
  GeneratePolicyPdfInput,
  GeneratePolicyPdfOutput,
  DocumentServiceClientOptions,
} from "./types";

// Export security utilities (if needed)
export * from "./security";

// Re-export from client utilities
export { ServiceClient } from "./client/base-client";
export {
  ExcelServiceClient,
  createExcelServiceClient,
} from "./clients/excel-client";
export {
  DocumentServiceClient,
  createDocumentServiceClient,
} from "./clients/document-client";

// Common utilities
export { withErrorHandling } from "./rpc/errors";
export { withTelemetry } from "./rpc/telemetry";

// Type aliases for common usage
export type {
  // RPC core types
  RpcRequest,
  RpcResponse,
  RpcErrorInterface as RpcError,
  ServiceBinding,

  // Excel service types
  ExcelRpcService,
  GeneratePremiumWorkbookInput,
  GeneratePremiumWorkbookOutput,
  ExcelServiceClientOptions,

  // Document service types
  DocumentRpcService,
  GeneratePolicyPdfInput,
  GeneratePolicyPdfOutput,
  DocumentServiceClientOptions,

  // Common types
  WorkerEnvironment,
  WorkerRequestHandler,
  ValidationResult,
} from "./types";

// Helper functions
export function generateRequestId(prefix: string = "req"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createRpcResponse<T>(
  success: boolean,
  data?: T,
  error?: {
    code: string;
    message: string;
    details?: unknown;
  },
  metadata?: {
    requestId?: string;
    processingTimeMs?: number;
  },
) {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(error && { error }),
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

export function validateWithSchema<T>(
  schema: any, // Zod schema
  data: unknown,
  options?: {
    strict?: boolean;
    context?: Record<string, unknown>;
  },
): { isValid: boolean; data?: T; errors?: any } {
  try {
    const result = options?.strict
      ? schema.strict().parse(data, { context: options?.context })
      : schema.parse(data, { context: options?.context });

    return {
      isValid: true,
      data: result as T,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: error,
    };
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private measurements = new Map<string, number[]>();
  private maxSamples = 1000;

  record(operation: string, duration: number): void {
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }

    const measurements = this.measurements.get(operation)!;
    measurements.push(duration);

    if (measurements.length > this.maxSamples) {
      measurements.shift();
    }
  }

  getMetrics(operation: string): PerformanceMetrics | null {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;
    const total = sorted.reduce((a, b) => a + b, 0);
    const average = total / count;

    return {
      count,
      average,
      p50: this.percentile(sorted, 0.5),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      total,
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.floor(p * (sorted.length - 1));
    return sorted[index];
  }

  clear(operation?: string): void {
    if (operation) {
      this.measurements.delete(operation);
    } else {
      this.measurements.clear();
    }
  }
}

// Cache utility
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });

    // Clean up expired entries occasionally
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

// Export version
export const SHARED_INFRA_VERSION = "1.0.0";
