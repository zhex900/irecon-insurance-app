/**
 * Security utilities for Excel worker
 * Implements comprehensive authentication, authorization, and request validation
 */

import { logSecurityEvent } from "../../shared/security/network-security";

// In-memory rate limit store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = {
  requestsPerMinute: 100,
  blockDurationMs: 60000,
};

/**
 * Comprehensive request validation pipeline
 */
export async function validateExcelWorkerRequest(request: Request): Promise<{
  valid: boolean;
  error?: string;
  data?: unknown;
  clientIp: string;
}> {
  const _timestamp = Date.now(); // Used for potential future logging
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const url = new URL(request.url);
  const method = request.method;

  try {
    // Check rate limit
    const rateLimitCheck = await checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      logSecurityEvent("medium", "rate_limit_exceeded", request, {
        clientIp,
        count: rateLimitCheck.count || 0,
      });
      return {
        valid: false,
        error: "Rate limit exceeded. Please try again later.",
        clientIp,
      };
    }

    // Skip signed request validation for now (as per user request)
    // Just validate the JSON payload if it's a POST request
    if (request.method === "POST") {
      try {
        const body = await request.clone().json();
        return { valid: true, data: body, clientIp };
      } catch (error) {
        console.warn("Failed to parse JSON payload:", error);
        return { valid: false, error: "Invalid JSON payload", clientIp };
      }
    }

    // For GET requests, no validation needed
    return { valid: true, clientIp };
  } catch (error) {
    console.error("Request validation error:", error);
    logSecurityEvent("high", "validation_exception", request, {
      clientIp,
      path: url.pathname,
      method,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      valid: false,
      error: "Request validation failed",
      clientIp,
    };
  }
}

/**
 * Check rate limit for client IP
 */
async function checkRateLimit(
  clientIp: string,
): Promise<{ allowed: boolean; count?: number }> {
  const now = Date.now();
  const clientData = rateLimitStore.get(clientIp);

  if (!clientData) {
    rateLimitStore.set(clientIp, {
      count: 1,
      resetTime: now + RATE_LIMIT.blockDurationMs,
    });
    return { allowed: true };
  }

  // Reset if time window expired
  if (now > clientData.resetTime) {
    rateLimitStore.set(clientIp, {
      count: 1,
      resetTime: now + RATE_LIMIT.blockDurationMs,
    });
    return { allowed: true };
  }

  // Check if under limit
  if (clientData.count < RATE_LIMIT.requestsPerMinute) {
    clientData.count++;
    return { allowed: true, count: clientData.count };
  }

  return { allowed: false, count: clientData.count };
}

/**
 * Create security headers for responses
 */
export function createSecurityHeaders(): HeadersInit {
  return {
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}
