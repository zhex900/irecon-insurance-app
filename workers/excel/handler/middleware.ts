/**
 * Middleware for Excel worker handler
 * Provides security, logging, and request processing
 */

import {
  validateOrigin,
  validateContentType,
  sanitizeHeaders,
  logSecurityEvent,
  validatePath,
} from "../../shared/security/network-security";

// Environment configuration
import type { ExcelWorkerEnv } from "../types/env";
type WorkerEnv = { [key: string]: unknown } & ExcelWorkerEnv;

// CORS configuration
const ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:8787"];

// Rate limiting configuration
const RATE_LIMIT = {
  requestsPerMinute: 100,
  blockDurationMs: 60000, // 1 minute
};

// In-memory rate limit store (for demo - use KV in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Basic request validation (signature validation removed as per user request)
 */
export async function validateServiceRequest(
  request: Request,
  env: WorkerEnv,
): Promise<{ valid: boolean; error?: string; data?: unknown }> {
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";

  // 1. Validate request path to prevent path traversal
  if (!validatePath(request)) {
    logSecurityEvent("high", "path_traversal_attempt", request, { clientIp });
    return {
      valid: false,
      error: "Invalid request path",
    };
  }

  // 2. Check rate limit
  if (!(await checkRateLimit(clientIp))) {
    logSecurityEvent("medium", "rate_limit_exceeded", request, { clientIp });
    return {
      valid: false,
      error: "Rate limit exceeded",
    };
  }

  // 3. Validate content type (for POST requests)
  if (request.method === "POST" && !validateContentType(request)) {
    return {
      valid: false,
      error: "Invalid Content-Type",
    };
  }

  // For POST requests, just parse JSON data
  if (request.method === "POST") {
    try {
      const body = await request.clone().json();
      return {
        valid: true,
        data: body,
      };
    } catch (error) {
      console.warn(`Failed to parse JSON from ${clientIp}:`, error);
      return {
        valid: false,
        error: "Invalid JSON payload",
      };
    }
  }

  // For GET requests, check CORS origin
  const origin = request.headers.get("Origin");
  if (origin && !isOriginAllowed(origin, env)) {
    return {
      valid: false,
      error: "Origin not allowed",
    };
  }

  return {
    valid: true,
  };
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string, env: WorkerEnv): boolean {
  const allowedOrigins = [...ALLOWED_ORIGINS];
  if (env.APP_URL) {
    allowedOrigins.push(env.APP_URL);
  }
  return validateOrigin(
    new Request("http://localhost", {
      headers: { Origin: origin },
    }),
    env,
    allowedOrigins,
  );
}

/**
 * Check rate limit for client IP
 */
async function checkRateLimit(clientIp: string): Promise<boolean> {
  const now = Date.now();
  const clientData = rateLimitStore.get(clientIp);

  if (!clientData) {
    rateLimitStore.set(clientIp, {
      count: 1,
      resetTime: now + RATE_LIMIT.blockDurationMs,
    });
    return true;
  }

  // Reset if time window expired
  if (now > clientData.resetTime) {
    rateLimitStore.set(clientIp, {
      count: 1,
      resetTime: now + RATE_LIMIT.blockDurationMs,
    });
    return true;
  }

  // Check if under limit
  if (clientData.count < RATE_LIMIT.requestsPerMinute) {
    clientData.count++;
    return true;
  }

  return false;
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
  response: Response,
  request: Request,
  env: WorkerEnv,
): Response {
  const origin = request.headers.get("Origin");
  const headers = new Headers(response.headers);

  if (origin && isOriginAllowed(origin, env)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Service-Token",
  );
  headers.set("Access-Control-Allow-Credentials", "true");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Log request details for monitoring
 */
export function logRequest(
  request: Request,
  status: number,
  processingTimeMs: number,
  clientIp: string,
): void {
  const sanitizedHeaders = sanitizeHeaders(request.headers);
  console.log({
    method: request.method,
    path: new URL(request.url).pathname,
    status,
    processingTimeMs,
    clientIp,
    timestamp: new Date().toISOString(),
    userAgent: sanitizedHeaders.get("User-Agent") || "unknown",
  });
}
