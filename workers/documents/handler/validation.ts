// Document worker request validation utilities
import { MAX_PDF_RENDER_REQUEST_BYTES } from "../constants";
import type { ZodSchema } from "zod";

/**
 * Parse JSON request body with size limits
 */
export async function parseBoundedJson(request: Request): Promise<unknown> {
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

/**
 * Validate request against a Zod schema
 */
export function validateRequestSchema<T>(
  data: unknown,
  schema: ZodSchema<T>,
): { success: true; data: T } | { success: false; errors: unknown } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: result.error,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Create structured error response
 */
export function createErrorResponse(
  errorType: string,
  status: number,
  requestId?: string,
): Response {
  return Response.json({ error: errorType, requestId }, { status });
}

/**
 * Common error types for the document worker
 */
export const ERROR_TYPES = {
  INVALID_REQUEST: "invalid_request",
  PAYLOAD_TOO_LARGE: "payload_too_large",
  RENDER_FAILED: "render_failed",
  METHOD_NOT_ALLOWED: "method_not_allowed",
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
} as const;
