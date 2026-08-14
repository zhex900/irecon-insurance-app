// Document worker main handler
import type { DocumentWorkerEnv } from "../types/env";
import { findRoute } from "./routes";
import {
  validateRequestSchema,
  createErrorResponse,
  parseBoundedJson,
  ERROR_TYPES,
} from "./validation";

// Import structured logger
import { logger } from "../../../app/lib/observability/logger.server";

/**
 * Main document worker handler
 */
export async function handler(
  request: Request,
  env: DocumentWorkerEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const requestId = request.headers.get("x-request-id") ?? undefined;

  try {
    // 1. Find route handler (authentication removed as per user request)
    const route = findRoute(method, path);
    if (!route) {
      return createErrorResponse(ERROR_TYPES.NOT_FOUND, 404, requestId);
    }

    // 3. Validate request if schema exists
    let validatedData: unknown = undefined;
    if (route.schema) {
      const body = await parseBoundedJson(request);
      // Type assertion is needed here because route.schema is z.ZodSchema<unknown>
      const validationResult = validateRequestSchema(body, route.schema);

      if (!validationResult.success) {
        return createErrorResponse(ERROR_TYPES.INVALID_REQUEST, 400, requestId);
      }

      validatedData = validationResult.data;
    }

    // 4. Execute route handler
    // Type assertion is needed because route.handler expects specific validatedData type
    // We use unknown then cast to the handler function type
    const handler = route.handler as (
      request: Request,
      env: DocumentWorkerEnv,
      validatedData: unknown,
    ) => Promise<Response>;
    return await handler(request, env, validatedData);
  } catch (error) {
    // Handle specific error types
    if (error instanceof RangeError && error.message === "payload_too_large") {
      return createErrorResponse(ERROR_TYPES.PAYLOAD_TOO_LARGE, 413, requestId);
    }

    // Log unexpected errors with structured logging
    logger.error("Document handler error", {
      operation: "document.handler",
      requestId,
      route: path,
      method,
      error: error instanceof Error ? error.message : "unknown_error",
      errorType: error instanceof Error ? error.name : typeof error,
    });

    return createErrorResponse(ERROR_TYPES.RENDER_FAILED, 500, requestId);
  }
}
