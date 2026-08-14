/**
 * Server-side Excel Worker configuration.
 * This file contains server-only constants with environment variables.
 */

/** Default Excel Worker configuration */
export const DEFAULT_EXCEL_WORKER_CONFIG = {
  /** Default Excel Worker URL */
  EXCEL_WORKER_URL: process.env.EXCEL_WORKER_URL || "http://localhost:8788",

  /** Whether Excel Worker is enabled (enabled by default) */
  EXCEL_WORKER_ENABLED: process.env.EXCEL_WORKER_ENABLED !== "false",

  /** Request timeout in milliseconds */
  EXCEL_WORKER_TIMEOUT_MS: parseInt(
    process.env.EXCEL_WORKER_TIMEOUT_MS || "10000",
    10,
  ),

  /** Maximum request size in bytes (1MB) */
  EXCEL_WORKER_MAX_REQUEST_SIZE: 1024 * 1024,
} as const;
