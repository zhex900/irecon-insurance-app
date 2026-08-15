import {
  PDF_RENDER_PATH,
  MAX_PDF_RENDER_REQUEST_BYTES,
} from "../../app/lib/pdf/document-worker-contract";
import { generatePdf } from "./generate-pdf";

type PdfWorkerHandler = {
  fetch(request: Request, env: PdfWorkerEnv): Promise<Response>;
};

function jsonError(
  error: "not_found" | "method_not_allowed",
  status: number,
  requestId?: string,
) {
  return Response.json({ error, requestId }, { status });
}

export default {
  async fetch(request: Request, env: PdfWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const requestId = request.headers.get("x-request-id") ?? undefined;

    if (url.pathname !== PDF_RENDER_PATH) {
      return jsonError("not_found", 404, requestId);
    }
    if (request.method !== "POST") {
      return jsonError("method_not_allowed", 405, requestId);
    }

    return generatePdf(request, env);
  },
} satisfies PdfWorkerHandler;
