/**
 * Main handler for Excel worker
 * Routes requests and applies middleware
 */

import { matchRoute, handleOptionsRequest } from "./routes";
import { applyCorsHeaders, logRequest } from "./middleware";
import {
  validateRequestSize,
  validateRequestMethod,
  validateJsonRequest,
  validateExcelWorkerRequest as validateExcelSchema,
} from "./validation";
import { validateExcelWorkerRequest } from "./security";

// Import structured logger
import { logger } from "../../../app/lib/observability/logger.server";

// Environment interface - use a consistent type alias
import type { ExcelWorkerEnv } from "../types/env";
type Env = {
  [key: string]: unknown;
} & ExcelWorkerEnv;

/**
 * Main handler function
 */
export async function handler(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";

  try {
    // Log request with structured logging
    logger.info("Excel Worker request received", {
      operation: "excel.handler",
      method: request.method,
      path: url.pathname,
      clientIp,
    });

    // Handle OPTIONS preflight
    if (request.method === "OPTIONS") {
      const response = handleOptionsRequest();
      logRequest(request, response.status, Date.now() - startTime, clientIp);
      return response;
    }

    // Validate request size
    const sizeValidation = await validateRequestSize(request);
    if (!sizeValidation.valid) {
      const response = new Response(
        JSON.stringify({ error: sizeValidation.error }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
      logRequest(request, 413, Date.now() - startTime, clientIp);
      return applyCorsHeaders(response, request, env);
    }

    // Match route
    const route = matchRoute(request);
    if (!route) {
      const response = new Response(
        JSON.stringify({ error: "Route not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
      logRequest(request, 404, Date.now() - startTime, clientIp);
      return applyCorsHeaders(response, request, env);
    }

    // Validate request method
    const methodValidation = validateRequestMethod(request, [route.method]);
    if (!methodValidation.valid) {
      const response = new Response(
        JSON.stringify({ error: methodValidation.error }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
      logRequest(request, 405, Date.now() - startTime, clientIp);
      return applyCorsHeaders(response, request, env);
    }

    // Apply basic security validation (signature validation removed as per user request)
    const securityValidation = await validateExcelWorkerRequest(request);

    if (!securityValidation.valid) {
      const status = securityValidation.error?.includes("Rate limit")
        ? 429
        : securityValidation.error?.includes("Access denied")
          ? 403
          : 401;

      const response = new Response(
        JSON.stringify({
          error: securityValidation.error || "Authentication required",
          timestamp: new Date().toISOString(),
        }),
        {
          status,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60", // For rate limiting
          },
        },
      );
      logRequest(request, status, Date.now() - startTime, clientIp);
      return applyCorsHeaders(response, request, env);
    }

    // Validate JSON for POST requests
    let validatedData: unknown = securityValidation.data;
    if (request.method === "POST" && !validatedData) {
      const jsonValidation = await validateJsonRequest(request);
      if (!jsonValidation.valid) {
        const response = new Response(
          JSON.stringify({ error: jsonValidation.error }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
        logRequest(request, 400, Date.now() - startTime, clientIp);
        return applyCorsHeaders(response, request, env);
      }
      validatedData = jsonValidation.data;
    }

    // Validate against route schema if provided
    if (route.schema && validatedData) {
      const schemaValidation = validateExcelSchema(validatedData);
      if (!schemaValidation.valid) {
        const response = new Response(
          JSON.stringify({ error: schemaValidation.error }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
        logRequest(request, 400, Date.now() - startTime, clientIp);
        return applyCorsHeaders(response, request, env);
      }
    }

    // Execute route handler
    const response = await route.handler(request, env, validatedData);

    // Apply CORS headers and log
    const finalResponse = applyCorsHeaders(response, request, env);
    logRequest(request, finalResponse.status, Date.now() - startTime, clientIp);

    return finalResponse;
  } catch (error) {
    // Log unexpected error with structured logging
    logger.error("Excel Worker handler error", {
      operation: "excel.handler",
      method: request.method,
      path: url.pathname,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown_error",
      errorType: error instanceof Error ? error.name : typeof error,
      clientIp,
    });

    const errorResponse = new Response(
      JSON.stringify({
        error: "Internal server error",
        requestId: Math.random().toString(36).substring(2, 15),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );

    logRequest(request, 500, Date.now() - startTime, clientIp);
    return errorResponse;
  }
}
