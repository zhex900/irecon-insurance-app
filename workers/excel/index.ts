/**
 * Excel Worker - Clean Entry Point
 * Main export file following domain-based worker pattern
 */

import { handler } from "./handler";
import type { ExcelWorkerEnv } from "./types/env";

// Export the handler as the worker entry point
export default {
  async fetch(request: Request, env: ExcelWorkerEnv): Promise<Response> {
    return handler(request, env);
  },
};

// Export types for external consumption
export type { ExcelWorkerRequest, ExcelWorkerResponse } from "./types/schemas";
export type { ExcelWorkerEnv } from "./types/env";
export type {
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
  AdjustmentBreakdown,
} from "../../app/lib/types/excel-worker-types";

// Note: Removed all constant exports to avoid conflict with Cloudflare Workers runtime
// which expects all top-level exports to be functions or ExportedHandler instances

// Note: Removed all function exports to avoid any potential conflicts
// Cloudflare Workers expects only the default export or handlers as top-level exports
