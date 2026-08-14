// Document worker constants and configuration

export const PDF_RENDER_PATH = "/render";
export const MAX_PDF_RENDER_REQUEST_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Font configuration for PDF generation
 */
export const FONT_FILES = {
  "Roboto Bold": "Roboto-Bold.ttf",
  "Roboto Italic": "Roboto-Italic.ttf",
  "Roboto Bold Italic": "Roboto-BoldItalic.ttf",
  "Times New Roman": "Tinos-Regular.ttf",
  "Times New Roman Bold": "Tinos-Bold.ttf",
  "Times New Roman Italic": "Tinos-Italic.ttf",
  "Times New Roman Bold Italic": "Tinos-BoldItalic.ttf",
} as const;

/**
 * HTTP methods supported by the document worker
 */
export const SUPPORTED_METHODS = ["POST"] as const;

/**
 * Error types for structured error responses
 */
export const ERROR_TYPES = {
  INVALID_REQUEST: "invalid_request",
  PAYLOAD_TOO_LARGE: "payload_too_large",
  RENDER_FAILED: "render_failed",
  METHOD_NOT_ALLOWED: "method_not_allowed",
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
} as const;
