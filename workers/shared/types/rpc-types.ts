/**
 * RPC TypeScript interfaces derived from Zod schemas
 * Core RPC communication types for service-to-service communication
 */

// Re-export types from schemas
import type {
  RpcMetadata,
  RpcResponse,
  RpcErrorCode,
  HealthCheck,
  ServiceInfo,
} from "../schemas/common";

export type {
  RpcMetadata,
  RpcResponse,
  RpcErrorCode,
  HealthCheck,
  ServiceInfo,
};

// RPC error interface
export interface RpcErrorInterface {
  code: RpcErrorCode;
  message: string;
  details?: unknown;
  statusCode?: number;
  requestId?: string;
  correlationId?: string;
  timestamp?: number;
}

// RPC request interface
export interface RpcRequest<TInput = unknown> {
  method: string;
  input: TInput;
  metadata?: {
    requestId?: string;
    timeoutMs?: number;
    correlationId?: string;
    traceId?: string;
    source?: string;
    timestamp?: number;
  };
}

// RPC response interface
export interface RpcResponseInterface<T = unknown> {
  success: boolean;
  data?: T;
  error?: RpcErrorInterface;
  metadata?: {
    requestId?: string;
    timestamp?: number;
    processingTimeMs?: number;
    service?: string;
    method?: string;
  };
}

// Service binding interface (Cloudflare Workers)
export interface ServiceBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// RPC client configuration
export interface RpcClientConfig {
  serviceBinding: ServiceBinding;
  serviceName: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  retryOnNetworkError?: boolean;
  telemetryEnabled?: boolean;
  telemetrySampleRate?: number;
  requestIdGenerator?: () => string;
}

// RPC method definition
export interface RpcMethodDefinition<_TInput = unknown, _TOutput = unknown> {
  name: string;
  description?: string;
  inputSchema?: unknown; // Zod schema reference
  outputSchema?: unknown; // Zod schema reference
  timeoutMs?: number;
  retryable?: boolean;
  requiresAuth?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

// RPC service definition
export interface RpcServiceDefinition {
  serviceName: string;
  version: string;
  description?: string;
  environment?: string;
  methods: Record<string, RpcMethodDefinition<unknown, unknown>>;
  dependencies?: string[];
  capabilities?: string[];
}

// RPC service registry
export interface RpcServiceRegistry {
  registerService(definition: RpcServiceDefinition): void;
  getService(name: string, version?: string): RpcServiceDefinition | null;
  listServices(): RpcServiceDefinition[];
  discoverServices(): Promise<RpcServiceDefinition[]>;
}

// RPC middleware context
export interface RpcMiddlewareContext {
  service: string;
  method: string;
  requestId: string;
  startTime: number;
  metadata: Record<string, unknown>;
}

// RPC middleware function
export type RpcMiddleware = (
  context: RpcMiddlewareContext,
  next: () => Promise<RpcResponseInterface>,
) => Promise<RpcResponseInterface>;

// Common RPC middleware types
export enum RpcMiddlewareType {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  LOGGING = "logging",
  TELEMETRY = "telemetry",
  RATE_LIMITING = "rate_limiting",
  CACHING = "caching",
  COMPRESSION = "compression",
  RETRY = "retry",
  TIMEOUT = "timeout",
}

// RPC health status
export interface RpcHealthStatus {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  uptime?: number;
  checks?: Record<
    string,
    {
      status: "healthy" | "unhealthy";
      latencyMs?: number;
      message?: string;
    }
  >;
  dependencies?: Record<string, RpcHealthStatus>;
}

// RPC telemetry event
export interface RpcTelemetryEvent {
  service: string;
  method: string;
  requestId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    inputSize?: number;
    outputSize?: number;
    source?: string;
    correlationId?: string;
    traceId?: string;
    userAgent?: string;
  };
}

// RPC client factory options
export interface RpcClientFactoryOptions {
  defaultTimeoutMs?: number;
  defaultMaxRetries?: number;
  enableTelemetry?: boolean;
  telemetryEndpoint?: string;
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
  };
  cache?: {
    enabled?: boolean;
    ttlMs?: number;
    strategy?: "memory" | "redis" | "custom";
  };
}

// RPC service discovery
export interface RpcServiceDiscovery {
  discover(): Promise<Map<string, RpcServiceDefinition>>;
  register(service: RpcServiceDefinition): Promise<void>;
  deregister(serviceName: string): Promise<void>;
  healthCheck(): Promise<Map<string, RpcHealthStatus>>;
}

// RPC circuit breaker state
export interface RpcCircuitBreakerState {
  service: string;
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime?: number;
  successCount: number;
  resetTimeoutMs: number;
}

// RPC cache configuration
export interface RpcCacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxSize?: number;
  strategy: "memory" | "redis" | "custom";
  keyBuilder?: (request: RpcRequest) => string;
}

// RPC rate limiting configuration
export interface RpcRateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
  keyBuilder?: (request: RpcRequest) => string;
  skipOnError?: boolean;
}

// Complete RPC configuration
export interface RpcConfiguration {
  // Client configuration
  client: {
    defaultTimeoutMs: number;
    maxRetries: number;
    retryBaseDelayMs: number;
    retryMaxDelayMs: number;
  };

  // Server configuration
  server: {
    maxRequestBodySize: number;
    requestTimeoutMs: number;
    maxConcurrentRequests: number;
  };

  // Telemetry configuration
  telemetry: {
    enabled: boolean;
    sampleRate: number;
    endpoint?: string;
    batchSize: number;
    flushIntervalMs: number;
  };

  // Security configuration
  security: {
    enableValidation: boolean;
    validationStrict: boolean;
    enableAuth: boolean;
    authMethods: string[];
  };

  // Performance configuration
  performance: {
    enableCaching: boolean;
    cacheTtlMs: number;
    enableCompression: boolean;
    compressionLevel: "none" | "fast" | "maximum";
  };

  // Monitoring configuration
  monitoring: {
    enableHealthChecks: boolean;
    healthCheckIntervalMs: number;
    enableMetrics: boolean;
    metricsEndpoint?: string;
  };

  // Service discovery configuration
  discovery: {
    enabled: boolean;
    registryUrl?: string;
    refreshIntervalMs: number;
  };
}
