// Export shared security utilities

// Re-export from auth with renamed logSecurityEvent to avoid conflict
export {
  type WorkerEnv,
  logSecurityEvent as logAuthSecurityEvent,
} from "./auth";

// Export everything from signing
export * from "./signing";

// Export everything from network-security
export {
  DEFAULT_SECURITY_HEADERS,
  DEFAULT_RATE_LIMIT_CONFIG,
  validateOrigin,
  applySecurityHeaders,
  isMethodAllowed,
  validateContentType,
  sanitizeHeaders,
  logSecurityEvent,
  isSuspiciousUserAgent,
  validatePath,
} from "./network-security";

export type { SignedRequest } from "./signing";
export type { SecurityHeaders, RateLimitConfig } from "./network-security";
