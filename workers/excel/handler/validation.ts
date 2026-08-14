/**
 * Request validation utilities for Excel worker
 */

import { z } from "zod";
import type { HealthResponse, InfoResponse } from "../types/schemas";
import {
  excelWorkerRequestSchema,
  premiumWorkbookDataSchema,
} from "../types/schemas";

// Maximum request size (1MB)
const MAX_REQUEST_SIZE_BYTES = 1024 * 1024;

/**
 * Validate request size
 */
export async function validateRequestSize(
  request: Request,
): Promise<{ valid: boolean; error?: string }> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_REQUEST_SIZE_BYTES) {
      return {
        valid: false,
        error: `Request too large: ${size} bytes exceeds ${MAX_REQUEST_SIZE_BYTES} limit`,
      };
    }
  }

  // Read body to verify actual size
  try {
    const body = await request.clone().text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_SIZE_BYTES) {
      return {
        valid: false,
        error: "Request body too large",
      };
    }
  } catch {
    // Ignore errors for size validation
  }

  return { valid: true };
}

/**
 * Validate JSON request body
 */
export async function validateJsonRequest(request: Request): Promise<{
  valid: boolean;
  error?: string;
  data?: unknown;
}> {
  const contentType = request.headers.get("Content-Type");
  if (contentType !== "application/json") {
    return {
      valid: false,
      error: "Content-Type must be application/json",
    };
  }

  try {
    const body = await request.clone().json();
    return {
      valid: true,
      data: body,
    };
  } catch {
    return {
      valid: false,
      error: "Invalid JSON in request body",
    };
  }
}

/**
 * Validate Excel worker request
 */
export function validateExcelWorkerRequest(
  data: unknown,
  expectedReportType?: string,
): {
  valid: boolean;
  error?: string;
  validated?: z.infer<typeof excelWorkerRequestSchema>;
} {
  const result = excelWorkerRequestSchema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      error: "Invalid request format",
    };
  }

  const validated = result.data;

  // Check if specific report type is expected
  if (expectedReportType && validated.reportType !== expectedReportType) {
    return {
      valid: false,
      error: `Expected report type '${expectedReportType}' but got '${validated.reportType}'`,
    };
  }

  return {
    valid: true,
    validated,
  };
}

/**
 * Validate premium workbook data
 */
export function validatePremiumWorkbookData(data: unknown): {
  valid: boolean;
  error?: string;
  validated?: z.infer<typeof premiumWorkbookDataSchema>;
} {
  const result = premiumWorkbookDataSchema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      error: "Invalid premium workbook data",
    };
  }

  return {
    valid: true,
    validated: result.data,
  };
}

/**
 * Validate health check response
 */
export function validateHealthResponse(data: unknown): HealthResponse {
  const baseResponse = {
    status: "healthy" as const,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };

  if (typeof data === "object" && data !== null) {
    const typedData = data as Partial<HealthResponse>;
    return {
      status: typedData.status || "healthy",
      version: typedData.version || "1.0.0",
      timestamp: typedData.timestamp || new Date().toISOString(),
    };
  }

  return baseResponse;
}

/**
 * Validate info response
 */
export function validateInfoResponse(data: unknown): InfoResponse {
  const baseResponse: InfoResponse = {
    service: "Excel Worker",
    version: "1.0.0",
    endpoints: ["/api/excel/generate", "/health", "/info"],
    capabilities: ["premiumWorkbook", "customReports", "formulaGeneration"],
  };

  if (typeof data === "object" && data !== null) {
    const typedData = data as Partial<InfoResponse>;
    return {
      service: typedData.service || baseResponse.service,
      version: typedData.version || baseResponse.version,
      endpoints: Array.isArray(typedData.endpoints)
        ? typedData.endpoints
        : baseResponse.endpoints,
      capabilities: Array.isArray(typedData.capabilities)
        ? typedData.capabilities
        : baseResponse.capabilities,
    };
  }

  return baseResponse;
}

/**
 * Safe JSON parsing with validation
 */
export function safeParseJson<T>(
  text: string,
  schema?: z.ZodSchema<T>,
): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const parsed = JSON.parse(text);

    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        return {
          success: false,
          error: "JSON does not match schema",
        };
      }
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate request method
 */
export function validateRequestMethod(
  request: Request,
  allowedMethods: string[],
): {
  valid: boolean;
  error?: string;
} {
  const method = request.method;
  if (!allowedMethods.includes(method)) {
    return {
      valid: false,
      error: `Method ${method} not allowed. Allowed methods: ${allowedMethods.join(", ")}`,
    };
  }
  return { valid: true };
}
