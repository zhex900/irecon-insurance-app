import {
  MAX_PDF_RENDER_REQUEST_BYTES,
  pdfRenderRequestSchema,
} from "../../app/lib/pdf/document-worker-contract";
import { generatePolicyPdf } from "../../app/lib/pdf/generate";
import { getDocumentWorkerFonts } from "./fonts";

function jsonError(
  error:
    "invalid_request" | "payload_too_large" | "render_failed" | "not_found",
  status: number,
  requestId?: string,
) {
  return Response.json({ error, requestId }, { status });
}

function requestIdFromUnknown(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("requestId" in value)) {
    return undefined;
  }
  return typeof value.requestId === "string"
    ? value.requestId.slice(0, 128)
    : undefined;
}

function payloadTooLarge(value: unknown): boolean {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== "string") return false;
    return (
      new TextEncoder().encode(json).byteLength > MAX_PDF_RENDER_REQUEST_BYTES
    );
  } catch {
    return false;
  }
}

export async function generatePdf(
  requestData: unknown,
  env: PdfWorkerEnv,
): Promise<Response> {
  const requestId = requestIdFromUnknown(requestData);

  try {
    if (payloadTooLarge(requestData)) {
      return jsonError("payload_too_large", 413, requestId);
    }

    const parsed = pdfRenderRequestSchema.safeParse(requestData);
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
    console.error(
      JSON.stringify({
        event: "document.render_failed",
        requestId,
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return jsonError("render_failed", 500, requestId);
  }
}
