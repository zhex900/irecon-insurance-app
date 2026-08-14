/**
 * Base RPC client for service-to-service communication
 */

import type { ServiceBinding } from "./types";
import { RpcError, TimeoutError, ServiceUnavailableError } from "./errors";
import {
  type RpcResponse,
  RPC_ERROR_CODES,
} from "../schemas/common/base.schema";

export interface RpcClientOptions {
  /** Service binding instance */
  serviceBinding: ServiceBinding;
  /** Service name for logging and identification */
  serviceName: string;
  /** Base URL for the service */
  baseUrl?: string;
  /** Default timeout for requests (ms) */
  timeoutMs?: number;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Base delay between retries (ms) */
  retryBaseDelayMs?: number;
  /** Maximum delay between retries (ms) */
  retryMaxDelayMs?: number;
  /** Whether to enable retry on network errors */
  retryOnNetworkError?: boolean;
  /** Request ID generator function */
  requestIdGenerator?: () => string;
}

export interface RpcRequest<TInput = unknown> {
  method: string;
  input: TInput;
  metadata?: {
    requestId?: string;
    timeoutMs?: number;
    correlationId?: string;
    traceId?: string;
  };
}

export class RpcClient {
  private serviceBinding: ServiceBinding;
  private serviceName: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private retryBaseDelayMs: number;
  private retryMaxDelayMs: number;
  private retryOnNetworkError: boolean;
  private requestIdGenerator: () => string;

  constructor(options: RpcClientOptions) {
    this.serviceBinding = options.serviceBinding;
    this.serviceName = options.serviceName;
    this.baseUrl = options.baseUrl || `https://${this.serviceName}.internal`;
    this.timeoutMs = options.timeoutMs || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs || 1000;
    this.retryMaxDelayMs = options.retryMaxDelayMs || 10000;
    this.retryOnNetworkError = options.retryOnNetworkError ?? true;
    this.requestIdGenerator =
      options.requestIdGenerator ||
      (() =>
        `${this.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }

  /**
   * Make an RPC call with retry logic and error handling
   */
  async call<TMethod extends string, TInput, TOutput>(
    method: TMethod,
    input: TInput,
    metadata?: RpcRequest<TInput>["metadata"],
  ): Promise<TOutput> {
    const requestId = metadata?.requestId || this.requestIdGenerator();
    const timeoutMs = metadata?.timeoutMs || this.timeoutMs;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(method, input, {
          requestId,
          timeoutMs,
          correlationId: metadata?.correlationId ?? "",
          traceId: metadata?.traceId ?? "",
        });

        const result = await this.handleResponse<TOutput>(response);

        if (attempt > 0) {
          console.info(`RPC call succeeded on retry ${attempt}:`, {
            service: this.serviceName,
            method,
            requestId,
          });
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Decide whether to retry
        const shouldRetry = this.shouldRetry(error, attempt);

        if (!shouldRetry) {
          throw this.enrichError(error, method, requestId, attempt);
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt);

        if (attempt < this.maxRetries) {
          console.warn(`RPC call failed, retrying in ${delay}ms:`, {
            service: this.serviceName,
            method,
            requestId,
            attempt: attempt + 1,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          await this.delay(delay);
          continue;
        }
      }
    }

    throw (
      lastError ||
      new RpcError(
        `Failed to call ${this.serviceName}.${method} after ${this.maxRetries} retries`,
        RPC_ERROR_CODES.SERVICE_UNAVAILABLE,
      )
    );
  }

  /**
   * Make a single RPC request
   */
  private async makeRequest<TInput>(
    method: string,
    input: TInput,
    metadata: Required<NonNullable<RpcRequest<TInput>["metadata"]>>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), metadata.timeoutMs);

    try {
      const url = `${this.baseUrl}/rpc/${method}`;

      const requestBody: RpcRequest<TInput> = {
        method,
        input,
        metadata: {
          requestId: metadata.requestId,
          timeoutMs: metadata.timeoutMs,
          correlationId: metadata.correlationId,
          traceId: metadata.traceId,
        },
      };

      const response = await this.serviceBinding.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": metadata.requestId,
          "X-Service-Name": this.serviceName,
          "X-RPC-Method": method,
          "X-RPC-Timestamp": Date.now().toString(),
          ...(metadata.correlationId && {
            "X-Correlation-Id": metadata.correlationId,
          }),
          ...(metadata.traceId && { "X-Trace-Id": metadata.traceId }),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle RPC response
   */
  private async handleResponse<TOutput>(response: Response): Promise<TOutput> {
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // If we can't parse the error response, use the status text
        errorData = { message: response.statusText };
      }

      throw new RpcError(
        errorData.message || `HTTP ${response.status}`,
        this.mapHttpStatusToErrorCode(response.status),
        errorData.details,
        response.status,
      );
    }

    const responseData = (await response.json()) as RpcResponse<TOutput>;

    // Validate response structure
    if (!responseData.success && responseData.error) {
      throw new RpcError(
        responseData.error.message,
        responseData.error
          .code as (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES],
        responseData.error.details,
      );
    }

    if (!responseData.success) {
      throw new RpcError(
        "RPC call failed without error details",
        RPC_ERROR_CODES.INTERNAL_ERROR,
      );
    }

    return responseData.data as TOutput;
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.maxRetries) return false;

    // Always retry on timeout if retryOnNetworkError is enabled
    if (this.retryOnNetworkError && error instanceof TimeoutError) {
      return true;
    }

    // Retry on network errors
    if (this.retryOnNetworkError && error instanceof Error) {
      const isNetworkError =
        (error.name === "TypeError" && error.message.includes("fetch")) ||
        error.name === "AbortError" ||
        error.message.includes("network") ||
        error.message.includes("connection");

      if (isNetworkError) {
        return true;
      }
    }

    // Don't retry validation errors or unauthorized errors
    if (error instanceof RpcError) {
      const nonRetryableCodes = [
        RPC_ERROR_CODES.VALIDATION_FAILED,
        RPC_ERROR_CODES.UNAUTHORIZED,
        RPC_ERROR_CODES.NOT_FOUND,
        RPC_ERROR_CODES.BUSINESS_RULE_VIOLATION,
      ];

      return !nonRetryableCodes.includes(
        error.code as typeof RPC_ERROR_CODES.VALIDATION_FAILED,
      );
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.retryBaseDelayMs * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.retryMaxDelayMs);

    // Add jitter (±20%)
    const jitter = cappedDelay * 0.2;
    const min = cappedDelay - jitter;
    const max = cappedDelay + jitter;

    return min + Math.random() * (max - min);
  }

  /**
   * Add context to error
   */
  private enrichError(
    error: unknown,
    method: string,
    requestId: string,
    attempt: number,
  ): Error {
    const baseError = error instanceof Error ? error : new Error(String(error));

    if (error instanceof RpcError) {
      return error;
    }

    return new RpcError(
      `RPC call ${this.serviceName}.${method} failed after ${attempt + 1} attempts: ${baseError.message}`,
      RPC_ERROR_CODES.INTERNAL_ERROR,
      {
        originalError: baseError.message,
        requestId,
        service: this.serviceName,
        method,
        attempts: attempt + 1,
      },
    );
  }

  /**
   * Map HTTP status codes to RPC error codes
   */
  private mapHttpStatusToErrorCode(
    status: number,
  ): (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES] {
    switch (status) {
      case 400:
        return RPC_ERROR_CODES.VALIDATION_FAILED;
      case 401:
      case 403:
        return RPC_ERROR_CODES.UNAUTHORIZED;
      case 404:
        return RPC_ERROR_CODES.NOT_FOUND;
      case 408:
        return RPC_ERROR_CODES.TIMEOUT;
      case 429:
        return RPC_ERROR_CODES.RATE_LIMITED;
      case 503:
        return RPC_ERROR_CODES.SERVICE_UNAVAILABLE;
      default:
        return RPC_ERROR_CODES.INTERNAL_ERROR;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check convenience method
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await this.serviceBinding.fetch(
        `${this.baseUrl}/health`,
        {
          method: "GET",
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get service info
   */
  async getServiceInfo(): Promise<Record<string, unknown>> {
    try {
      const response = await this.serviceBinding.fetch(`${this.baseUrl}/info`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new ServiceUnavailableError(this.serviceName);
      }

      return await response.json();
    } catch (error) {
      throw new ServiceUnavailableError(this.serviceName, error);
    }
  }
}
