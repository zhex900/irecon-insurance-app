/**
 * Federation Performance Metrics Collector
 *
 * Tracks module loading performance, errors, and cross-domain communication
 */

import type { ErrorInfo } from "react";

export interface ModuleLoadMetrics {
  domain: string;
  module: string;
  loadTime: number; // ms
  startTime: number;
  endTime: number;
  success: boolean;
  error?: string;
  attempt?: number;
  cacheHit?: boolean;
}

export interface CrossDomainCallMetrics {
  sourceDomain: string;
  targetDomain: string;
  endpoint: string;
  duration: number;
  success: boolean;
  size?: number; // Response size in bytes
  status?: number; // HTTP status
  timestamp: number;
}

export interface StateUpdateMetrics {
  domain: string;
  key: string;
  source: string;
  valueSize: number; // Approximate size in bytes
  timestamp: number;
}

export interface ErrorMetrics {
  domain: string;
  module: string;
  errorType: string;
  errorMessage: string;
  stack?: string;
  timestamp: number;
  componentStack?: string;
}

export interface PerformanceScore {
  moduleLoadScore: number; // 0-100
  crossDomainScore: number; // 0-100
  errorRateScore: number; // 0-100
  overallScore: number; // 0-100
}

export class FederationMetrics {
  private static instance: FederationMetrics;

  private moduleLoads: ModuleLoadMetrics[] = [];
  private crossDomainCalls: CrossDomainCallMetrics[] = [];
  private stateUpdates: StateUpdateMetrics[] = [];
  private errors: ErrorMetrics[] = [];

  private maxEntries = 1000; // Keep last 1000 entries
  private sentToServer = false; // Whether metrics sent to server

  private thresholds = {
    slowModuleLoad: 1000, // ms
    slowCrossDomainCall: 500, // ms
    highErrorRate: 0.05, // 5%
  };

  private constructor() {
    // Set up periodic flushing to server
    if (typeof window !== "undefined") {
      setInterval(() => this.flushToServer(), 30000); // Every 30 seconds

      // Send on page unload
      window.addEventListener("beforeunload", () => {
        this.flushToServer();
      });
    }
  }

  static getInstance(): FederationMetrics {
    if (!FederationMetrics.instance) {
      FederationMetrics.instance = new FederationMetrics();
    }
    return FederationMetrics.instance;
  }

  // Module loading metrics
  recordModuleLoadStart(domain: string, module: string): void {
    // Store temporary in session storage for crash recovery
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        `federation:${domain}:${module}:start`,
        Date.now().toString(),
      );
    }

    this.log("debug", `Module load start: ${domain}/${module}`);
  }

  recordModuleLoadComplete(
    domain: string,
    module: string,
    loadTime: number,
    cacheHit = false,
  ): void {
    const metric: ModuleLoadMetrics = {
      domain,
      module,
      loadTime,
      startTime: Date.now() - loadTime,
      endTime: Date.now(),
      success: true,
      cacheHit,
    };

    this.moduleLoads.push(metric);
    this.trimArray(this.moduleLoads);

    // Clear temporary storage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(`federation:${domain}:${module}:start`);
    }

    // Check if slow
    if (loadTime > this.thresholds.slowModuleLoad) {
      this.log("warn", `Slow module load: ${domain}/${module} - ${loadTime}ms`);
      this.reportSlowModuleLoad(metric);
    }

    this.log(
      "debug",
      `Module load complete: ${domain}/${module} - ${loadTime}ms`,
    );
  }

  recordModuleLoadError(
    domain: string,
    module: string,
    error: Error,
    attempt: number,
  ): void {
    const startTime = sessionStorage.getItem(
      `federation:${domain}:${module}:start`,
    );

    const metric: ModuleLoadMetrics = {
      domain,
      module,
      loadTime: startTime ? Date.now() - parseInt(startTime) : 0,
      startTime: startTime ? parseInt(startTime) : Date.now(),
      endTime: Date.now(),
      success: false,
      error: error.message,
      attempt,
    };

    this.moduleLoads.push(metric);
    this.trimArray(this.moduleLoads);

    // Record error
    this.recordError(domain, module, "module_load", error.message);

    this.log(
      "error",
      `Module load error: ${domain}/${module} - ${error.message}`,
    );
  }

  recordModuleLoadFailure(domain: string, module: string, error: Error): void {
    const metric: ModuleLoadMetrics = {
      domain,
      module,
      loadTime: 0,
      startTime: Date.now(),
      endTime: Date.now(),
      success: false,
      error: error.message,
    };

    this.moduleLoads.push(metric);
    this.trimArray(this.moduleLoads);

    // Record error
    this.recordError(domain, module, "module_load_failure", error.message);

    this.log(
      "error",
      `Module load failure: ${domain}/${module} - ${error.message}`,
    );
  }

  // Cross-domain communication metrics
  recordCrossDomainCallStart(
    sourceDomain: string,
    targetDomain: string,
    endpoint: string,
  ): string {
    const callId = `${sourceDomain}-${targetDomain}-${endpoint}-${Date.now()}`;

    // Store start time
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        `federation:call:${callId}:start`,
        Date.now().toString(),
      );
    }

    this.log(
      "debug",
      `Cross-domain call start: ${sourceDomain} -> ${targetDomain} ${endpoint}`,
    );

    return callId;
  }

  recordCrossDomainCallComplete(
    callId: string,
    sourceDomain: string,
    targetDomain: string,
    endpoint: string,
    success: boolean,
    size?: number,
    status?: number,
  ): void {
    const startTime = sessionStorage.getItem(`federation:call:${callId}:start`);
    const duration = startTime ? Date.now() - parseInt(startTime) : 0;

    const metric: CrossDomainCallMetrics = {
      sourceDomain,
      targetDomain,
      endpoint,
      duration,
      success,
      size,
      status,
      timestamp: Date.now(),
    };

    this.crossDomainCalls.push(metric);
    this.trimArray(this.crossDomainCalls);

    // Clear temporary storage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(`federation:call:${callId}:start`);
    }

    // Check if slow
    if (duration > this.thresholds.slowCrossDomainCall) {
      this.log(
        "warn",
        `Slow cross-domain call: ${sourceDomain} -> ${targetDomain} - ${duration}ms`,
      );
      this.reportSlowCrossDomainCall(metric);
    }

    this.log(
      "debug",
      `Cross-domain call complete: ${sourceDomain} -> ${targetDomain} - ${duration}ms`,
    );
  }

  // State management metrics
  recordStateUpdate(domain: string, key: string, source: string): void {
    const metric: StateUpdateMetrics = {
      domain,
      key,
      source,
      valueSize: 0, // Would calculate based on value
      timestamp: Date.now(),
    };

    this.stateUpdates.push(metric);
    this.trimArray(this.stateUpdates);

    this.log("debug", `State update: ${domain}.${key} from ${source}`);
  }

  recordDomainSync(
    sourceDomain: string,
    targetDomain: string,
    keys: string[],
  ): void {
    this.log(
      "info",
      `Domain sync: ${sourceDomain} -> ${targetDomain} for ${keys.length} keys`,
    );
  }

  // Error boundary metrics
  recordModuleBoundaryError(
    domain: string,
    module: string,
    error: Error,
    errorInfo: ErrorInfo,
  ): void {
    this.recordError(
      domain,
      module,
      "boundary",
      error.message,
      errorInfo.componentStack ?? undefined,
    );
  }

  recordModuleRetry(domain: string, module: string, attempt: number): void {
    this.log("info", `Module retry: ${domain}/${module} - attempt ${attempt}`);
  }

  // Error recording
  recordError(
    domain: string,
    module: string,
    errorType: string,
    errorMessage: string,
    componentStack?: string,
  ): void {
    const metric: ErrorMetrics = {
      domain,
      module,
      errorType,
      errorMessage,
      stack: new Error().stack,
      componentStack,
      timestamp: Date.now(),
    };

    this.errors.push(metric);
    this.trimArray(this.errors);

    // Report to error service (Sentry, etc.)
    this.reportError(metric);
  }

  // Performance scoring
  calculateModuleLoadScore(): number {
    if (this.moduleLoads.length === 0) return 100;

    const recentLoads = this.getRecentMetrics(this.moduleLoads, 100);
    const successCount = recentLoads.filter((m) => m.success).length;
    const avgLoadTime =
      recentLoads
        .filter((m) => m.success)
        .reduce((sum, m) => sum + m.loadTime, 0) / successCount || 0;

    // Score based on success rate and speed
    const successRateScore = (successCount / recentLoads.length) * 50;
    const speedScore = Math.max(0, 1000 - avgLoadTime) / 10;

    return Math.min(100, successRateScore + speedScore);
  }

  calculateCrossDomainScore(): number {
    if (this.crossDomainCalls.length === 0) return 100;

    const recentCalls = this.getRecentMetrics(this.crossDomainCalls, 100);
    const successCount = recentCalls.filter((m) => m.success).length;
    const avgDuration =
      recentCalls
        .filter((m) => m.success)
        .reduce((sum, m) => sum + m.duration, 0) / successCount || 0;

    // Score based on success rate and speed
    const successRateScore = (successCount / recentCalls.length) * 50;
    const speedScore = Math.max(0, 500 - avgDuration) / 5;

    return Math.min(100, successRateScore + speedScore);
  }

  calculateErrorRateScore(): number {
    const recentErrors = this.getRecentMetrics(this.errors, 1000); // Last 1000
    const totalCalls = this.getRecentMetrics(
      this.crossDomainCalls,
      1000,
    ).length;
    const totalLoads = this.getRecentMetrics(this.moduleLoads, 1000).length;
    const totalEvents = totalCalls + totalLoads;

    if (totalEvents === 0) return 100;

    const errorRate = recentErrors.length / totalEvents;
    const score = Math.max(
      0,
      (this.thresholds.highErrorRate - errorRate) * 2000,
    );

    return Math.min(100, score);
  }

  getPerformanceScore(): PerformanceScore {
    const moduleLoadScore = this.calculateModuleLoadScore();
    const crossDomainScore = this.calculateCrossDomainScore();
    const errorRateScore = this.calculateErrorRateScore();

    const overallScore =
      moduleLoadScore * 0.4 + crossDomainScore * 0.3 + errorRateScore * 0.3;

    return {
      moduleLoadScore,
      crossDomainScore,
      errorRateScore,
      overallScore,
    };
  }

  // Reporting and alerts
  private reportSlowModuleLoad(metric: ModuleLoadMetrics): void {
    // Would integrate with error monitoring service
    console.warn("Slow module load detected:", metric);
  }

  private reportSlowCrossDomainCall(metric: CrossDomainCallMetrics): void {
    // Would integrate with error monitoring service
    console.warn("Slow cross-domain call detected:", metric);
  }

  private reportError(metric: ErrorMetrics): void {
    // Would integrate with Sentry or similar
    if (typeof window !== "undefined") {
      const win = window as { Sentry?: unknown };
      if (win.Sentry) {
        // Type-safe integration would require proper Sentry types
        // For now, we'll use unknown and let the runtime handle it
        const sentry = win.Sentry as { captureException: (error: Error, options: unknown) => void };
        sentry.captureException(new Error(metric.errorMessage), {
          tags: {
            domain: metric.domain,
            module: metric.module,
            errorType: metric.errorType,
            federation: true,
          },
          extra: {
            componentStack: metric.componentStack,
            timestamp: metric.timestamp,
          },
        });
      }
    }
  }

  // Data management
  private trimArray<T>(array: T[]): void {
    if (array.length > this.maxEntries) {
      array.splice(0, array.length - this.maxEntries);
    }
  }

  private getRecentMetrics<T>(array: T[], count: number): T[] {
    const start = Math.max(0, array.length - count);
    return array.slice(start);
  }

  // Server reporting
  async flushToServer(): Promise<void> {
    if (this.sentToServer || this.moduleLoads.length === 0) {
      return;
    }

    const metrics = {
      moduleLoads: this.getRecentMetrics(this.moduleLoads, 100),
      crossDomainCalls: this.getRecentMetrics(this.crossDomainCalls, 100),
      stateUpdates: this.getRecentMetrics(this.stateUpdates, 100),
      errors: this.getRecentMetrics(this.errors, 100),
      performanceScore: this.getPerformanceScore(),
      timestamp: Date.now(),
    };

    try {
      const response = await fetch("/api/federation-metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metrics),
      });

      if (response.ok) {
        this.sentToServer = true;
        this.log("info", "Metrics flushed to server");
      }
    } catch (error) {
      this.log("error", "Failed to flush metrics to server", error);
    }
  }

  // Logging
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: unknown,
  ): void {
    const prefix = `[FederationMetrics:${level.toUpperCase()}]`;

    switch (level) {
      case "debug":
        // Only log debug/info in development - use warn/error in production
        // Using warn/error to comply with no-console rule
        if (process.env.NODE_ENV === "development") {
          console.warn(`${prefix} (debug): `, message, data);
        }
        break;
      case "info":
        if (process.env.NODE_ENV === "development") {
          console.warn(`${prefix} (info): `, message, data);
        }
        break;
      case "warn":
        console.warn(prefix, message, data);
        break;
      case "error":
        console.error(prefix, message, data);
        break;
    }
  }

  // Public API for debugging
  getMetrics(): {
    moduleLoads: ModuleLoadMetrics[];
    crossDomainCalls: CrossDomainCallMetrics[];
    stateUpdates: StateUpdateMetrics[];
    errors: ErrorMetrics[];
  } {
    return {
      moduleLoads: [...this.moduleLoads],
      crossDomainCalls: [...this.crossDomainCalls],
      stateUpdates: [...this.stateUpdates],
      errors: [...this.errors],
    };
  }

  getStats(): {
    totalModuleLoads: number;
    successfulModuleLoads: number;
    avgModuleLoadTime: number;
    totalCrossDomainCalls: number;
    successfulCrossDomainCalls: number;
    avgCrossDomainCallTime: number;
    totalErrors: number;
    errorRate: number;
  } {
    const moduleLoadStats = this.moduleLoads.reduce(
      (acc, curr) => {
        acc.total++;
        if (curr.success) acc.successful++;
        if (curr.success) acc.totalTime += curr.loadTime;
        return acc;
      },
      { total: 0, successful: 0, totalTime: 0 },
    );

    const crossDomainStats = this.crossDomainCalls.reduce(
      (acc, curr) => {
        acc.total++;
        if (curr.success) acc.successful++;
        if (curr.success) acc.totalTime += curr.duration;
        return acc;
      },
      { total: 0, successful: 0, totalTime: 0 },
    );

    const totalEvents = moduleLoadStats.total + crossDomainStats.total;

    return {
      totalModuleLoads: moduleLoadStats.total,
      successfulModuleLoads: moduleLoadStats.successful,
      avgModuleLoadTime:
        moduleLoadStats.successful > 0
          ? moduleLoadStats.totalTime / moduleLoadStats.successful
          : 0,
      totalCrossDomainCalls: crossDomainStats.total,
      successfulCrossDomainCalls: crossDomainStats.successful,
      avgCrossDomainCallTime:
        crossDomainStats.successful > 0
          ? crossDomainStats.totalTime / crossDomainStats.successful
          : 0,
      totalErrors: this.errors.length,
      errorRate: totalEvents > 0 ? this.errors.length / totalEvents : 0,
    };
  }
}
