/**
 * Internal Application Performance Monitoring
 *
 * For internal insurance broker apps, we only monitor operations
 * that genuinely affect broker productivity.
 *
 * Using Sentry Free Plan (no performance monitoring, only error tracking).
 */

import { Sentry, setSentryRequestTags } from "~/lib/observability/sentry.server";

/**
 * Operation timeout thresholds for internal apps
 * These are what genuinely hurt broker productivity
 */
const OPERATION_TIMEOUTS = {
  // Critical workflow operations
  policyCreation: 3000, // 3 seconds to create a policy
  premiumCalculation: 2000, // 2 seconds for premium calc
  documentGeneration: 5000, // 5 seconds for PDF generation
  formSave: 1000, // 1 second to save form data
  policyLoad: 2000, // 2 seconds to load a policy

  // Data operations
  clientSearch: 1500, // 1.5 seconds for client search
  listPageLoad: 1500, // 1.5 seconds for SSR list loaders (/policies, /clients)
  reportGeneration: 3000, // 3 seconds for reports
  dataExport: 4000, // 4 seconds for exports

  // Default fallback
  default: 5000, // 5 seconds for any other operation
} as const;

type OperationType = keyof typeof OPERATION_TIMEOUTS;

/**
 * Track only genuinely slow operations that affect broker productivity
 * Sent to Sentry as error messages (since we don't have performance monitoring)
 */
export function monitorCriticalOperation<T>(
  operationType: OperationType | string,
  operation: () => Promise<T>,
  customTimeoutMs?: number,
): Promise<T> {
  const operationName =
    typeof operationType === "string" ? operationType : operationType;
  const timeoutMs =
    customTimeoutMs ||
    OPERATION_TIMEOUTS[operationType as OperationType] ||
    OPERATION_TIMEOUTS.default;

  const startTime = Date.now();

  return operation().finally(() => {
    const duration = Date.now() - startTime;

    // Only log genuinely problematic delays that hurt productivity
    if (duration > timeoutMs) {
      const message = `SLOW_OPERATION: ${operationName} took ${duration}ms (threshold: ${timeoutMs}ms)`;

      setSentryRequestTags();
      Sentry.captureMessage(message, {
        level: duration > timeoutMs * 2 ? "error" : "warning",
        extra: {
          operation: operationName,
          duration,
          timeout: timeoutMs,
          thresholdExceededBy: duration - timeoutMs,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        },
      });

      // Also log to console for local debugging
      if (process.env.NODE_ENV === "development") {
        console.warn(`⚠️ ${message}`);
      }
    }
  });
}

/**
 * Track multiple operations and get overall performance metrics
 * Useful for complex workflows like policy creation wizard
 */
export async function monitorWorkflow<T>(
  workflowName: string,
  operations: Array<{
    name: string;
    operation: () => Promise<unknown>;
    timeout?: number;
  }>,
  overallTimeoutMs: number = 10000, // 10 seconds for entire workflow
): Promise<T> {
  const startTime = Date.now();
  const operationResults: Array<unknown> = [];
  const operationDurations: Array<{ name: string; duration: number }> = [];

  for (const op of operations) {
    const opStart = Date.now();

    try {
      const result = await monitorCriticalOperation(
        op.name,
        op.operation,
        op.timeout,
      );
      operationResults.push(result);

      const duration = Date.now() - opStart;
      operationDurations.push({ name: op.name, duration });
    } catch (error) {
      // Log workflow failure
      setSentryRequestTags();
      Sentry.captureMessage(
        `WORKFLOW_FAILED: ${workflowName} failed at ${op.name}`,
        {
          level: "error",
          extra: {
            workflow: workflowName,
            failedOperation: op.name,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
        },
      );
      throw error;
    }
  }

  const totalDuration = Date.now() - startTime;

  // Log if entire workflow is too slow
  if (totalDuration > overallTimeoutMs) {
    setSentryRequestTags();
    Sentry.captureMessage(
      `SLOW_WORKFLOW: ${workflowName} took ${totalDuration}ms`,
      {
        level: "warning",
        extra: {
          workflow: workflowName,
          totalDuration,
          timeout: overallTimeoutMs,
          operationDurations,
          timestamp: new Date().toISOString(),
        },
      },
    );
  }

  return operationResults[operationResults.length - 1] as T;
}

/**
 * Create a monitored function wrapper for frequently used operations
 * Usage: const monitoredSavePolicy = monitorFunction('policySave', savePolicy);
 */
export function monitorFunction<Args extends unknown[], Return>(
  operationName: string,
  fn: (...args: Args) => Promise<Return>,
  timeoutMs?: number,
): (...args: Args) => Promise<Return> {
  return async (...args: Args): Promise<Return> => {
    return monitorCriticalOperation(
      operationName,
      () => fn(...args),
      timeoutMs,
    );
  };
}

/**
 * Get current operation timeouts for debugging/config
 */
export function getOperationTimeouts(): Record<string, number> {
  return { ...OPERATION_TIMEOUTS };
}

/**
 * Example usage in services:
 *
 * ```typescript
 * export async function calculatePremium(policyData: PolicyData) {
 *   return monitorCriticalOperation('premiumCalculation', async () => {
 *     // Your premium calculation logic
 *     return calculatePremiumForPolicy(policyData);
 *   });
 * }
 *
 * // Or using monitorFunction:
 * const monitoredSavePolicy = monitorFunction('policySave', savePolicy);
 * await monitoredSavePolicy(policyId, values);
 * ```
 */
