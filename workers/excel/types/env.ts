/**
 * Environment types for Excel worker
 */

export interface ExcelWorkerEnv {
  // Core security
  WORKER_SHARED_SECRET?: string;

  // Service configuration
  WORKER_VERSION?: string;
  APP_URL?: string;

  // Legacy support (deprecated)
  EXCEL_WORKER_SHARED_SECRET?: string;
  EXCEL_WORKER_SERVICE_TOKEN?: string;

  // Cloudflare bindings
  ASSETS?: { fetch: typeof fetch };

  // Cloudflare secrets
  SECRET_KEY?: string;

  // Other Cloudflare env variables
  [key: string]: unknown;
}
