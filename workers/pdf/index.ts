/**
 * PDF Worker RPC entry. Service bindings call methods on this class;
 * it is not a public HTTP worker.
 */

import { WorkerEntrypoint } from "cloudflare:workers";

import { generatePdf } from "./generate-pdf";

export default class PdfWorker extends WorkerEntrypoint<PdfWorkerEnv> {
  async fetch(): Promise<Response> {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  async generatePdf(requestData: unknown): Promise<Response> {
    return generatePdf(requestData, this.env);
  }
}
