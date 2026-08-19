/**
 * Excel Worker RPC entry. Service bindings call methods on this class;
 * it is not a public HTTP worker.
 */

import { WorkerEntrypoint } from "cloudflare:workers";

import { generateGenericExcel } from "./handler/generate-generic-excel";
import { generatePremiumExcel } from "./handler/generate-premium-excel";
import type { ExcelWorkerEnv } from "./types/env";

export default class ExcelWorker extends WorkerEntrypoint<ExcelWorkerEnv> {
  async fetch(): Promise<Response> {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  async generatePremiumExcel(requestData: unknown): Promise<Response> {
    return generatePremiumExcel(requestData);
  }

  async generateGenericExcel(requestData: unknown): Promise<Response> {
    return generateGenericExcel(requestData);
  }
}
