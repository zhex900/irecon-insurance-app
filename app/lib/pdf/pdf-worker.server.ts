import {
  MAX_PDF_RENDER_REQUEST_BYTES,
  MAX_PDF_RENDER_RESPONSE_BYTES,
  pdfRenderErrorSchema,
  pdfRenderRequestSchema,
  type PdfRenderRequest,
} from "~/lib/pdf/document-worker-contract";
import {
  trackDistribution,
  trackUsage,
} from "~/lib/observability/metrics.server";

export type PdfWorkerBinding = {
  generatePdf(input: PdfRenderRequest): Promise<Response>;
};

export class PdfRenderServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DocumentRenderServiceError";
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Render a bounded PDF through the private Cloudflare service binding. */
export async function renderPolicyPdf(
  pdfService: PdfWorkerBinding,
  input: PdfRenderRequest,
): Promise<Uint8Array> {
  const payload = pdfRenderRequestSchema.parse(input);
  const body = JSON.stringify(payload);
  if (byteLength(body) > MAX_PDF_RENDER_REQUEST_BYTES) {
    trackUsage("document.render", {
      result: "failure",
      reason: "request_too_large",
    });
    throw new PdfRenderServiceError(
      "Document render request is too large.",
      413,
    );
  }

  const started = Date.now();
  let response: Response;
  try {
    response = await pdfService.generatePdf(payload);
  } catch {
    trackUsage("document.render", {
      result: "failure",
      reason: "unavailable",
    });
    throw new PdfRenderServiceError(
      "Document generation is temporarily unavailable.",
      503,
    );
  }

  if (!response.ok) {
    const errorBody = pdfRenderErrorSchema.safeParse(
      await response.json().catch(() => null),
    );
    trackUsage("document.render", {
      result: "failure",
      reason:
        errorBody.success && errorBody.data.error === "payload_too_large"
          ? "request_too_large"
          : "upstream_error",
    });
    throw new PdfRenderServiceError(
      errorBody.success && errorBody.data.error === "payload_too_large"
        ? "Document render request is too large."
        : "Document generation is temporarily unavailable.",
      response.status,
    );
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PDF_RENDER_RESPONSE_BYTES) {
    await response.body?.cancel();
    trackUsage("document.render", {
      result: "failure",
      reason: "response_too_large",
    });
    throw new PdfRenderServiceError("Generated document is too large.", 502);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_RENDER_RESPONSE_BYTES) {
    trackUsage("document.render", {
      result: "failure",
      reason: "response_too_large",
    });
    throw new PdfRenderServiceError("Generated document is too large.", 502);
  }

  trackUsage("document.render", { result: "success" });
  trackDistribution("document.render.duration", Date.now() - started, {
    unit: "millisecond",
  });
  return bytes;
}
