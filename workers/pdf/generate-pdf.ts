import {
  MAX_PDF_RENDER_REQUEST_BYTES,
  pdfRenderRequestSchema,
} from "../../app/lib/pdf/document-worker-contract";
import { generatePolicyPdf } from "../../app/lib/pdf/generate";
import { getDocumentWorkerFonts } from "./fonts";

function jsonError(
  error:
    | "invalid_request"
    | "payload_too_large"
    | "render_failed"
    | "method_not_allowed"
    | "not_found",
  status: number,
  requestId?: string,
) {
  return Response.json({ error, requestId }, { status });
}

async function parseBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PDF_RENDER_REQUEST_BYTES) {
    throw new RangeError("payload_too_large");
  }
  const body = await request.text();
  if (
    new TextEncoder().encode(body).byteLength > MAX_PDF_RENDER_REQUEST_BYTES
  ) {
    throw new RangeError("payload_too_large");
  }
  return JSON.parse(body);
}

export async function generatePdf(
  request: Request,
  env: PdfWorkerEnv,
): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? undefined;

  try {
    const parsed = pdfRenderRequestSchema.safeParse(
      await parseBoundedJson(request),
    );
    if (!parsed.success) return jsonError("invalid_request", 400, requestId);

    const input = parsed.data;
    const result = await generatePolicyPdf(
      input.templateKey,
      input.policy,
      input.mergeInputs,
      input.template,
      {
        wordingCatalogue: input.wordingCatalogue,
        brokerFeeLines: input.brokerFeeLines,
        font: await getDocumentWorkerFonts(env.ASSETS),
      },
    );
    return new Response(Uint8Array.from(result.pdf).buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(result.pdf.byteLength),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-request-id": input.requestId,
      },
    });
  } catch (error) {
    if (error instanceof RangeError && error.message === "payload_too_large") {
      return jsonError("payload_too_large", 413, requestId);
    }
    console.error(
      JSON.stringify({
        event: "document.render_failed",
        requestId,
        error: error instanceof Error ? error.message : "unknown_error",
      }),
    );
    return jsonError("render_failed", 500, requestId);
  }
}
