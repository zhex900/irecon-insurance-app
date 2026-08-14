// Excel worker client service for internal service binding communication
import type {
  ExcelWorkerRequest,
  ExcelWorkerResponse,
} from "../../../workers/excel/types/schemas";
import type {
  AdjustmentBreakdown,
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";

export type ExcelServiceBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  hello(request: string): Promise<Response>;
  generatePremiumExcel(requestData: {
    reportType: string;
    data: {
      policy: Policy;
      premium: PremiumBreakdown;
      rating?: RatingSnapshot;
      adjustment?: AdjustmentBreakdown;
    };
    options?: Record<string, unknown>;
  }): Promise<Response>;
};

export class ExcelServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ExcelServiceError";
  }
}

/**
 * Call the Excel worker service via service binding
 */
export async function callExcelWorkerService(
  service: ExcelServiceBinding,
  request: ExcelWorkerRequest,
  options?: {
    timeoutMs?: number;
    requestId?: string;
  },
): Promise<ExcelWorkerResponse> {
  const timeoutMs = options?.timeoutMs || 30000; // 30 seconds default
  const requestId =
    options?.requestId ||
    `excel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Create signed request with timestamp
    const timestamp = Date.now();
    const requestBody = {
      payload: request,
      timestamp,
      serviceToken: "{{ secrets.WORKER_SHARED_SECRET }}", // Will be replaced by wrangler
      serviceName: "excel-worker",
    };

    const response = await service.fetch(`https://excel-service/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": "{{ secrets.WORKER_SHARED_SECRET }}", // Will be replaced by wrangler
        "X-Request-Id": requestId,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ExcelServiceError(
        `Excel service error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    const responseData = await response.json();

    // Validate response structure
    if (!responseData || typeof responseData !== "object") {
      throw new ExcelServiceError("Invalid response from Excel service", 502);
    }

    return responseData as ExcelWorkerResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ExcelServiceError("Excel service request timeout", 504);
    }

    if (error instanceof ExcelServiceError) {
      throw error;
    }

    throw new ExcelServiceError(
      `Excel service communication error: ${error instanceof Error ? error.message : "Unknown error"}`,
      503,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate a premium Excel workbook via service binding
 */
export async function generatePremiumExcelWorkbook(
  service: ExcelServiceBinding,
  policy: Policy,
  premiumBreakdown: PremiumBreakdown,
  options?: {
    includeAdjustment?: boolean;
    policyNumber?: string;
    clientName?: string;
    generatedBy?: string;
    requestId?: string;
  },
): Promise<ExcelWorkerResponse> {
  const request: ExcelWorkerRequest = {
    reportType: "premiumWorkbook",
    data: {
      policy,
      premium: premiumBreakdown,
      // Include adjustment data if needed
    },
    options: {
      premiumWorkbook: {
        policyNumber: options?.policyNumber,
        clientName: options?.clientName,
        appVersion: "1.0.0",
        includeAdjustment: options?.includeAdjustment,
        generatedBy: options?.generatedBy || "system",
      },
    },
  };

  return callExcelWorkerService(service, request, {
    requestId: options?.requestId,
  });
}

/**
 * Health check for Excel service
 */
export async function checkExcelServiceHealth(
  service: ExcelServiceBinding,
  timeoutMs: number = 5000,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await service.fetch(`https://excel-service/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
