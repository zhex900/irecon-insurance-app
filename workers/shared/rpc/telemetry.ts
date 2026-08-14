/**
 * RPC telemetry and monitoring infrastructure
 */

import type { RpcTelemetry } from "./types";

export interface TelemetryOptions {
  /** Whether telemetry is enabled */
  enabled: boolean;
  /** Sample rate (0-1) */
  sampleRate: number;
  /** Whether to log to console */
  logToConsole: boolean;
  /** Whether to send to external monitoring system */
  sendToMonitoring: boolean;
  /** Custom telemetry handler */
  customHandler?: (telemetry: RpcTelemetry) => Promise<void> | void;
}

export class RpcTelemetryCollector {
  private telemetryQueue: RpcTelemetry[] = [];
  private options: TelemetryOptions;
  private flushInterval: NodeJS.Timeout | null = null;
  private flushBatchSize = 50;

  constructor(options: Partial<TelemetryOptions> = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      sampleRate: options.sampleRate ?? 1.0,
      logToConsole: options.logToConsole ?? false,
      sendToMonitoring: options.sendToMonitoring ?? false,
      customHandler: options.customHandler,
    };

    // Start background flush if monitoring is enabled
    if (this.options.sendToMonitoring) {
      this.startBackgroundFlush();
    }
  }

  /**
   * Record an RPC telemetry event
   */
  record(
    telemetry: Omit<RpcTelemetry, "endTime" | "duration">,
  ): () => RpcTelemetry {
    const startTime = telemetry.startTime;
    const shouldSample = Math.random() < this.options.sampleRate;

    if (!shouldSample && !telemetry.error) {
      return () => ({ ...telemetry, endTime: Date.now(), duration: 0 });
    }

    const enhancedTelemetry: RpcTelemetry = {
      ...telemetry,
      startTime,
    };

    // Return a function to complete the telemetry recording
    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const completedTelemetry = {
        ...enhancedTelemetry,
        endTime,
        duration,
      };

      // Log to console if enabled
      if (this.options.logToConsole) {
        this.logToConsole(completedTelemetry);
      }

      // Add to queue for batch processing
      if (this.options.sendToMonitoring || this.options.customHandler) {
        this.telemetryQueue.push(completedTelemetry);

        // Flush if queue reaches batch size
        if (this.telemetryQueue.length >= this.flushBatchSize) {
          this.flush().catch(console.error);
        }
      }

      return completedTelemetry;
    };
  }

  /**
   * Wrap an RPC call with telemetry
   */
  async withTelemetry<T>(
    service: string,
    method: string,
    requestId: string,
    operation: () => Promise<T>,
    additionalMetadata?: Record<string, unknown>,
  ): Promise<T> {
    const shouldSample = Math.random() < this.options.sampleRate;

    if (!this.options.enabled || !shouldSample) {
      return operation();
    }

    const startTime = Date.now();
    const completeTelemetry = this.record({
      service,
      method,
      requestId,
      startTime,
      metadata: additionalMetadata,
    });

    try {
      const result = await operation();
      const telemetry = completeTelemetry();
      telemetry.success = true;
      return result;
    } catch (error) {
      const telemetry = completeTelemetry();
      telemetry.success = false;
      telemetry.error = {
        code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : String(error),
      };
      throw error;
    }
  }

  /**
   * Log telemetry to console
   */
  private logToConsole(telemetry: RpcTelemetry): void {
    const level = telemetry.success ? "info" : "error";
    const message = `RPC ${telemetry.service}.${telemetry.method} ${telemetry.success ? "succeeded" : "failed"}`;

    console[level](message, {
      service: telemetry.service,
      method: telemetry.method,
      requestId: telemetry.requestId,
      duration: telemetry.duration,
      success: telemetry.success,
      error: telemetry.error,
      metadata: telemetry.metadata,
    });
  }

  /**
   * Start background flush interval
   */
  private startBackgroundFlush(): void {
    this.flushInterval = setInterval(() => {
      if (this.telemetryQueue.length > 0) {
        this.flush().catch(console.error);
      }
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Flush telemetry queue
   */
  private async flush(): Promise<void> {
    if (this.telemetryQueue.length === 0) {
      return;
    }

    const batch = this.telemetryQueue.slice();
    this.telemetryQueue = [];

    try {
      // Send to external monitoring system if enabled
      if (this.options.sendToMonitoring) {
        await this.sendToMonitoringSystem(batch);
      }

      // Call custom handler if provided
      if (this.options.customHandler) {
        await Promise.all(
          batch.map((telemetry) =>
            Promise.resolve(this.options.customHandler!(telemetry)),
          ),
        );
      }
    } catch (error) {
      console.error("Failed to flush telemetry:", error);
      // Re-add batch to queue on failure (with deduplication)
      this.telemetryQueue = [...batch, ...this.telemetryQueue].slice(0, 1000);
    }
  }

  /**
   * Send telemetry to monitoring system
   */
  private async sendToMonitoringSystem(batch: RpcTelemetry[]): Promise<void> {
    // This is a placeholder for actual monitoring system integration
    // In a real implementation, this would send to Sentry, Datadog, etc.

    // For now, we'll just simulate a successful send
    console.debug(
      `Sending ${batch.length} telemetry events to monitoring system`,
    );

    // Collect metrics
    const metrics = {
      totalCalls: batch.length,
      successfulCalls: batch.filter((t) => t.success).length,
      failedCalls: batch.filter((t) => !t.success).length,
      averageDuration: Math.round(
        batch.reduce((sum, t) => sum + (t.duration || 0), 0) / batch.length,
      ),
      services: Array.from(new Set(batch.map((t) => t.service))),
    };

    console.debug("RPC Telemetry Metrics:", metrics);
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.telemetryQueue.length;
  }

  /**
   * Stop telemetry collection
   */
  stop(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining telemetry
    if (this.telemetryQueue.length > 0) {
      this.flush().catch(console.error);
    }
  }
}

// Singleton instance for global telemetry
export const globalTelemetry = new RpcTelemetryCollector();

/**
 * Telemetry middleware for RPC calls
 */
export function withTelemetry(
  telemetryCollector: RpcTelemetryCollector = globalTelemetry,
) {
  return async function telemetryMiddleware(
    next: (
      input: unknown,
      metadata?: Record<string, unknown>,
    ) => Promise<unknown>,
  ): Promise<
    (input: unknown, metadata?: Record<string, unknown>) => Promise<unknown>
  > {
    return async (
      input: unknown,
      metadata?: Record<string, unknown>,
    ): Promise<unknown> => {
      const requestId =
        typeof metadata?.requestId === "string"
          ? metadata.requestId
          : `req-${Date.now()}`;
      const service =
        typeof metadata?.service === "string" ? metadata.service : "unknown";
      const method =
        typeof metadata?.method === "string" ? metadata.method : "unknown";

      return telemetryCollector.withTelemetry(
        service,
        method,
        requestId,
        () => next(input, metadata),
        {
          ...metadata,
          inputType: typeof input,
          timestamp: Date.now(),
        },
      );
    };
  };
}

/**
 * Create enhanced RPC client with telemetry
 */
export class TelemetryRpcClient {
  private telemetryCollector: RpcTelemetryCollector;

  constructor(
    private baseClient: unknown, // Should be RpcClient type
    telemetryOptions?: Partial<TelemetryOptions>,
  ) {
    this.telemetryCollector = new RpcTelemetryCollector(telemetryOptions);
  }

  async call<TMethod extends string, TInput, TOutput>(
    method: TMethod,
    input: TInput,
    metadata?: Record<string, unknown>,
  ): Promise<TOutput> {
    return this.telemetryCollector.withTelemetry(
      (this.baseClient as { constructor?: { name?: string } }).constructor
        ?.name || "unknown",
      method,
      typeof metadata?.requestId === "string"
        ? metadata.requestId
        : `req-${Date.now()}`,
      async () => {
        const result = await (
          this.baseClient as {
            call: (
              method: string,
              input: unknown,
              metadata?: unknown,
            ) => Promise<unknown>;
          }
        ).call(method, input, metadata);
        return result as TOutput;
      },
      {
        service: "service", // Static string for service name
        method,
        inputSize: JSON.stringify(input).length,
        ...metadata,
      },
    );
  }

  getCollector(): RpcTelemetryCollector {
    return this.telemetryCollector;
  }
}

/**
 * Performance metrics utilities
 */
export interface PerformanceMetrics {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export class PerformanceMetricsCollector {
  private durations: number[] = [];
  private maxSamples = 1000;

  record(duration: number): void {
    this.durations.push(duration);

    // Keep only recent samples
    if (this.durations.length > this.maxSamples) {
      this.durations = this.durations.slice(-this.maxSamples);
    }
  }

  getMetrics(): PerformanceMetrics {
    if (this.durations.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    const sorted = [...this.durations].sort((a, b) => a - b);

    return {
      p50: this.percentile(sorted, 0.5),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: sorted.length,
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.floor(p * (sorted.length - 1));
    return sorted[index];
  }

  clear(): void {
    this.durations = [];
  }
}
