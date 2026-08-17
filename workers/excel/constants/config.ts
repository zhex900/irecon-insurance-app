/**
 * Configuration constants for Excel worker
 */

export const WORKER_VERSION = "2.0.0";

/** Defense-in-depth RPC payload cap (service bindings skip the app HTTP 4KB body limit). */
export const MAX_REQUEST_SIZE_BYTES = 1024 * 1024; // 1MB
export const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

export const CONTENT_TYPES = {
  EXCEL: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  JSON: "application/json",
  OCTET_STREAM: "application/octet-stream",
} as const;

export const CUSTOM_HEADERS = {
  GENERATION_TIME: "X-Generation-Time",
  REPORT_TYPE: "X-Report-Type",
  REPORT_SIZE: "X-Report-Size",
  REQUEST_ID: "X-Request-Id",
  SERVICE_VERSION: "X-Service-Version",
} as const;
