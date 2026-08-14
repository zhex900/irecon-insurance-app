/**
 * Configuration constants for Excel worker
 */

// Worker configuration
export const WORKER_VERSION = "2.0.0";

// Security configuration
export const MAX_REQUEST_SIZE_BYTES = 1024 * 1024; // 1MB
export const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 100;
export const SIGNATURE_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// CORS configuration
export const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8787",
];

// Report types
export const REPORT_TYPES = {
  POLICY: "policy",
  CLIENT: "client",
  PREMIUM: "premium",
  CUSTOM: "custom",
  EXPORT: "export",
  PREMIUM_WORKBOOK: "premiumWorkbook",
} as const;

// Content types
export const CONTENT_TYPES = {
  EXCEL: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  JSON: "application/json",
  OCTET_STREAM: "application/octet-stream",
} as const;

// File naming
export const FILENAME_PREFIXES = {
  PREMIUM_WORKBOOK: "premium-breakdown",
  POLICY_REPORT: "policy-report",
  CLIENT_REPORT: "client-report",
  CUSTOM_REPORT: "custom-report",
} as const;

// Performance monitoring thresholds (ms)
export const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 1000,
  GOOD: 3000,
  ACCEPTABLE: 5000,
  SLOW: 10000,
} as const;

// Error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
  SIZE_LIMIT_ERROR: "SIZE_LIMIT_ERROR",
  GENERATION_ERROR: "GENERATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

// Headers
export const CUSTOM_HEADERS = {
  GENERATION_TIME: "X-Generation-Time",
  REPORT_TYPE: "X-Report-Type",
  REPORT_SIZE: "X-Report-Size",
  REQUEST_ID: "X-Request-Id",
  SERVICE_VERSION: "X-Service-Version",
} as const;
