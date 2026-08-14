/**
 * RPC error types and handlers
 */

import type { RpcErrorCode } from "../schemas/common/base.schema";

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code: RpcErrorCode,
    readonly details?: unknown,
    readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "RpcError";

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, RpcError.prototype);
  }

  /**
   * Convert error to structured response format
   */
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * Validation error - schema validation failed
 */
export class ValidationError extends RpcError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_FAILED", details, 400);
    this.name = "ValidationError";
  }
}

/**
 * Service unavailable error - downstream service failure
 */
export class ServiceUnavailableError extends RpcError {
  constructor(serviceName: string, details?: unknown) {
    super(
      `Service ${serviceName} is unavailable`,
      "SERVICE_UNAVAILABLE",
      details,
      503,
    );
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Timeout error - request timed out
 */
export class TimeoutError extends RpcError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation ${operation} timed out after ${timeoutMs}ms`,
      "TIMEOUT",
      {
        operation,
        timeoutMs,
      },
      408,
    );
    this.name = "TimeoutError";
  }
}

/**
 * Unauthorized error - authentication/authorization failure
 */
export class UnauthorizedError extends RpcError {
  constructor(message: string = "Unauthorized", details?: unknown) {
    super(message, "UNAUTHORIZED", details, 401);
    this.name = "UnauthorizedError";
  }
}

/**
 * Not found error - resource not found
 */
export class NotFoundError extends RpcError {
  constructor(resource: string, details?: unknown) {
    super(`${resource} not found`, "NOT_FOUND", details, 404);
    this.name = "NotFoundError";
  }
}

/**
 * Business rule violation error
 */
export class BusinessRuleError extends RpcError {
  constructor(message: string, rule: string, details?: unknown) {
    super(
      message,
      "BUSINESS_RULE_VIOLATION",
      details ? { rule, ...details } : { rule },
      422,
    );
    this.name = "BusinessRuleError";
  }
}

/**
 * Rate limited error - too many requests
 */
export class RateLimitedError extends RpcError {
  constructor(retryAfterSeconds?: number, limit?: number, window?: string) {
    const message = "Rate limit exceeded";
    super(
      message,
      "RATE_LIMITED",
      {
        retryAfterSeconds,
        limit,
        window,
      },
      429,
    );
    this.name = "RateLimitedError";
  }
}

/**
 * Helper to create RPC error responses
 */
export function createErrorResponse(error: unknown, requestId?: string) {
  if (error instanceof RpcError) {
    return {
      ...error.toResponse(),
      metadata: { requestId: requestId || `req-${Date.now()}` },
    };
  }

  // Handle unexpected errors
  const rpcError = new RpcError(
    error instanceof Error ? error.message : "Internal server error",
    "INTERNAL_ERROR",
    error instanceof Error ? { stack: error.stack } : { raw: error },
  );

  return {
    ...rpcError.toResponse(),
    metadata: { requestId: requestId || `req-${Date.now()}` },
  };
}

/**
 * Error handler middleware utility
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  errorContext?: string,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Enhance error with context if provided
      if (errorContext && error instanceof Error) {
        error.message = `[${errorContext}] ${error.message}`;
      }
      throw error;
    }
  };
}
