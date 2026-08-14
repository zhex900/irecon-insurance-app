/**
 * Worker Context Helper
 *
 * Provides consistent request context and logging for worker environments.
 * Ensures structured logging with request context (requestId, userId, route)
 * similar to the main application logger.
 */

import { logger } from "./logger.server";

/**
 * Worker request context extracted from headers
 */
export interface WorkerRequestContext {
  requestId?: string;
  userId?: string;
  route?: string;
  workerType: "excel" | "documents" | "unknown";
}

/**
 * Create worker context from request headers
 */
export function createWorkerContext(headers: Headers): WorkerRequestContext {
  const requestId = headers.get("x-request-id") || undefined;
  const userId = headers.get("x-user-id") || undefined;
  const route = headers.get("x-route") || undefined;
  const workerType =
    (headers.get("x-worker-type") as "excel" | "documents" | null) || "unknown";

  return {
    requestId,
    userId,
    route,
    workerType,
  };
}

/**
 * Flatten worker context to primitive values for structured logging
 */
function flattenWorkerContext(
  context: WorkerRequestContext | undefined,
): Record<string, string | undefined> {
  if (!context) return {};

  return {
    requestId: context.requestId,
    userId: context.userId,
    route: context.route,
    workerType: context.workerType,
  };
}

/**
 * Convert unknown record to LogFields by filtering to primitive values only
 */
function sanitizeFields(
  fields?: Record<string, unknown>,
): Record<string, string | number | boolean | null | undefined> {
  if (!fields) return {};

  const result: Record<string, string | number | boolean | null | undefined> =
    {};

  for (const [key, value] of Object.entries(fields)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      value === undefined
    ) {
      result[key] = value;
    }
    // Non-primitive values are omitted from logs for safety
  }

  return result;
}

/**
 * Structured logger for worker environments
 * Auto-includes worker context from headers
 */
export const workerLogger = {
  debug: (
    message: string,
    fields?: Record<string, unknown>,
    headers?: Headers,
  ) => {
    const context = headers ? createWorkerContext(headers) : undefined;
    logger.debug(message, {
      ...sanitizeFields(fields),
      ...flattenWorkerContext(context),
    });
  },

  info: (
    message: string,
    fields?: Record<string, unknown>,
    headers?: Headers,
  ) => {
    const context = headers ? createWorkerContext(headers) : undefined;
    logger.info(message, {
      ...sanitizeFields(fields),
      ...flattenWorkerContext(context),
    });
  },

  warn: (
    message: string,
    fields?: Record<string, unknown>,
    headers?: Headers,
  ) => {
    const context = headers ? createWorkerContext(headers) : undefined;
    logger.warn(message, {
      ...sanitizeFields(fields),
      ...flattenWorkerContext(context),
    });
  },

  error: (
    message: string,
    fields?: Record<string, unknown>,
    headers?: Headers,
  ) => {
    const context = headers ? createWorkerContext(headers) : undefined;
    logger.error(message, {
      ...sanitizeFields(fields),
      ...flattenWorkerContext(context),
    });
  },
};
