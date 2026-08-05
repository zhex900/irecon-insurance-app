import {
  MAX_PDF_RENDER_REQUEST_BYTES,
  MAX_PDF_RENDER_RESPONSE_BYTES,
  PDF_RENDER_PATH,
  pdfRenderErrorSchema,
  pdfRenderRequestSchema,
  type PdfRenderRequest,
} from "~/lib/pdf/document-worker-contract";

export type DocumentServiceBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export class DocumentRenderServiceError extends Error {
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
  service: DocumentServiceBinding,
  input: PdfRenderRequest,
): Promise<Uint8Array> {
  const payload = pdfRenderRequestSchema.parse(input);
  const body = JSON.stringify(payload);
  if (byteLength(body) > MAX_PDF_RENDER_REQUEST_BYTES) {
    throw new DocumentRenderServiceError(
      "Document render request is too large.",
      413,
    );
  }

  let response: Response;
  try {
    response = await service.fetch(
      `https://document-service${PDF_RENDER_PATH}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": payload.requestId,
        },
        body,
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch {
    throw new DocumentRenderServiceError(
      "Document generation is temporarily unavailable.",
      503,
    );
  }

  if (!response.ok) {
    const errorBody = pdfRenderErrorSchema.safeParse(
      await response.json().catch(() => null),
    );
    throw new DocumentRenderServiceError(
      errorBody.success && errorBody.data.error === "payload_too_large"
        ? "Document render request is too large."
        : "Document generation is temporarily unavailable.",
      response.status,
    );
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PDF_RENDER_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new DocumentRenderServiceError(
      "Generated document is too large.",
      502,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_RENDER_RESPONSE_BYTES) {
    throw new DocumentRenderServiceError(
      "Generated document is too large.",
      502,
    );
  }
  return bytes;
}
