/**
 * Excel Worker - Clean Entry Point
 * Main export file following domain-based worker pattern
 */

import { handler } from "./handler";
import type { ExcelWorkerEnv } from "./types/env";
import { handleGeneratePremiumWorkbook } from "./handler/routes";
import type {
  AdjustmentBreakdown,
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
} from "../../app/lib/types/excel-worker-types";

// Export the handler as the worker entry point
export default {
  async fetch(request: Request, env: ExcelWorkerEnv): Promise<Response> {
    return handler(request, env);
  },
  async hello(request: Request): Promise<Response> {
    console.log("Hello, world!", request);
    return new Response(" back to you Hello, world!");
  },
  async generatePremiumExcel(
    requestData: {
      reportType: string;
      data: {
        policy: Policy;
        premium: PremiumBreakdown;
        rating?: RatingSnapshot;
        adjustment?: AdjustmentBreakdown;
      };
      options?: Record<string, unknown>;
    },
    env: ExcelWorkerEnv,
  ): Promise<Response> {
    return handleGeneratePremiumWorkbook(requestData, env);
  },
};

// For future RPC support, we can implement a separate WorkerEntrypoint class
// export default class ExcelWorker extends WorkerEntrypoint<ExcelWorkerEnv> {
//   async fetch(request: Request): Promise<Response> {
//     return handler(request, this.env);
//   }
//
//   async generatePremiumWorkbook(data: any): Promise<any> {
//     // RPC implementation here
//   }
// }

// Export types for external consumption
export type { ExcelWorkerRequest, ExcelWorkerResponse } from "./types/schemas";
export type { ExcelWorkerEnv } from "./types/env";
export type {
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
  AdjustmentBreakdown,
} from "../../app/lib/types/excel-worker-types";
