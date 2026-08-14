/**
 * Network security utilities for worker services
 * Implements comprehensive security measures for service-to-service communication
 */

import type { WorkerEnv } from "./auth";

export interface SecurityHeaders {
  "Content-Security-Policy"?: string;
  "Strict-Transport-Security"?: string;
  "X-Content-Type-Options"?: string;
  "X-Frame-Options"?: string;
  "X-XSS-Protection"?: string;
  "Referrer-Policy"?: string;
  "Permissions-Policy"?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  blockDurationMs: number;
  maxRequestSizeBytes: number;
}

/**
 * Default security headers for worker responses
 */
export const DEFAULT_SECURITY_HEADERS: SecurityHeaders = {
  "Content-Security-Policy":
    "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

/**
 * Default rate limiting configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 100,
  blockDurationMs: 60000,
  maxRequestSizeBytes: 10 * 1024 * 1024, // 10MB
};

/**
 * Validate request origin against allowed origins
 */
export function validateOrigin(
  request: Request,
  env: WorkerEnv,
  allowedOrigins: string[] = [],
): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) {
    // No origin header, this could be a same-origin request or a request without Origin header
    return true;
  }

  const allowedOriginsList = [
    ...allowedOrigins,
    "http://localhost:5173",
    "http://localhost:8787",
  ];

  if (env.APP_URL) {
    allowedOriginsList.push(env.APP_URL);
  }

  return allowedOriginsList.includes(origin);
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(
  response: Response,
  customHeaders: SecurityHeaders = {},
): Response {
  const headers = new Headers(response.headers);

  // Apply default security headers
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value);
    }
  });

  // Apply custom headers (override defaults if provided)
  Object.entries(customHeaders).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value);
    }
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Check request method is allowed
 */
export function isMethodAllowed(
  request: Request,
  allowedMethods: string[] = ["GET", "POST", "OPTIONS"],
): boolean {
  const method = request.method;
  return allowedMethods.includes(method);
}

/**
 * Validate content type
 */
export function validateContentType(
  request: Request,
  allowedTypes: string[] = ["application/json"],
): boolean {
  const contentType = request.headers.get("Content-Type");
  if (!contentType) {
    // No content type for GET/HEAD/OPTIONS is okay
    return request.method !== "POST";
  }

  return allowedTypes.some((type) => contentType.startsWith(type));
}

/**
 * Sanitize request headers to prevent header injection attacks
 */
export function sanitizeHeaders(headers: Headers): Headers {
  const cleanHeaders = new Headers();
  const forbiddenHeaders = [
    "Proxy-Authenticate",
    "Proxy-Authorization",
    "Set-Cookie",
    "Set-Cookie2",
  ];

  for (const [key, value] of headers.entries()) {
    // Skip forbidden headers
    if (forbiddenHeaders.includes(key)) {
      continue;
    }

    // Sanitize header values (basic protection against CRLF injection)
    const sanitizedValue = value.replace(/\r/g, "").replace(/\n/g, "").trim();

    cleanHeaders.set(key, sanitizedValue);
  }

  return cleanHeaders;
}

/**
 * Log security event for monitoring and alerting
 */
export function logSecurityEvent(
  severity: "low" | "medium" | "high",
  event: string,
  request: Request,
  details: Record<string, unknown> = {},
): void {
  const securityLog = {
    timestamp: new Date().toISOString(),
    severity,
    event: `security.${event}`,
    method: request.method,
    path: new URL(request.url).pathname,
    ip: request.headers.get("CF-Connecting-IP") || "unknown",
    userAgent: request.headers.get("User-Agent") || "unknown",
    ...details,
  };

  if (severity === "high") {
    console.error("SECURITY ALERT:", JSON.stringify(securityLog));
  } else if (severity === "medium") {
    console.warn("Security event:", JSON.stringify(securityLog));
  } else {
    console.log("Security check:", JSON.stringify(securityLog));
  }
}

/**
 * Block suspicious user agents
 */
export function isSuspiciousUserAgent(request: Request): boolean {
  const userAgent = request.headers.get("User-Agent") || "";
  const suspiciousPatterns = [
    /^$/i, // Empty user agent
    /curl\/[0-9]/i, // cURL
    /wget/i, // wget
    /python-requests/i, // Python requests
    /libwww-perl/i, // Perl LWP
    /masscan/i, // Masscan
    /nmap/i, // Nmap
    /nikto/i, // Nikto
    /sqlmap/i, // SQLMap
    /acunetix/i, // Acunetix
    /appscan/i, // AppScan
    /nessus/i, // Nessus
    /metasploit/i, // Metasploit
    /burpsuite/i, // Burp Suite
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
}

/**
 * Validate request path to prevent path traversal attacks
 */
export function validatePath(request: Request): boolean {
  const url = new URL(request.url);
  const path = url.pathname;

  // Block path traversal attempts
  const traversalPatterns = [
    /\.\.\//, // Directory traversal
    /\.\.%2f/i, // URL encoded directory traversal
    /%2e%2e%2f/i, // Double URL encoded
    /\/\.\.\//, // Another form of directory traversal
    /\/\.\.$/i, // Traversal at end
  ];

  return !traversalPatterns.some((pattern) => pattern.test(path));
}
