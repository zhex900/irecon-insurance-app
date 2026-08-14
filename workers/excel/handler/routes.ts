/**
 * Route definitions for Excel worker
 */

import type { ExcelWorkerEnv } from "../types/env";
import type { ZodSchema } from "zod";
type WorkerEnv = { [key: string]: unknown } & ExcelWorkerEnv;
import { 
  excelWorkerRequestSchema, 
  type ExcelWorkerRequest,
  customReportDataSchema,
} from "../types/schemas";
import type { z } from "zod";
import type {
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
  AdjustmentBreakdown,
} from "~/lib/types/excel-worker-types";

// Route handler function type
export type RouteHandler = (
  request: Request,
  env: WorkerEnv,
  validatedData?: unknown,
) => Promise<Response>;

// Route definition interface
export interface Route {
  method: string;
  path: string;
  schema?: ZodSchema; // Zod schema for validation
  handler: RouteHandler;
  requireAuth?: boolean;
  requireSignedRequest?: boolean;
}

// Import service functions
import type { BuildPremiumExcelInput } from "../services/excel-types";

/**
 * Generate premium Excel workbook
 */
async function handleGeneratePremiumWorkbook(
  request: Request,
  env: WorkerEnv,
  validatedData?: unknown,
): Promise<Response> {
  try {
    // Import services dynamically to avoid initial load time
    const { buildPremiumExcelWorkbook } = await import("../services");

    if (!validatedData) {
      return new Response(JSON.stringify({ error: "Missing request data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract data from excelWorkerRequestSchema format
    const requestData = validatedData as {
      reportType: string;
      data: {
        policy: Policy;
        premium: PremiumBreakdown;
        rating?: RatingSnapshot;
        adjustment?: AdjustmentBreakdown;
      };
      options?: Record<string, unknown>;
    };

    // Validate that we have premium workbook data
    if (requestData.reportType !== "premiumWorkbook") {
      return new Response(
        JSON.stringify({ error: "Invalid report type, expected premiumWorkbook" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const input: BuildPremiumExcelInput = {
      policy: requestData.data.policy,
      premium: requestData.data.premium,
      rating: requestData.data.rating,
      adjustment: requestData.data.adjustment,
      generatedBy: "Excel Worker Handler",
      appVersion: env.WORKER_VERSION || "1.0.0",
    };

    const bytes = await buildPremiumExcelWorkbook(input);

    // Create filename
    const policyNumber = requestData.data.policy?.policyNumber || "unknown";
    const when = new Date();
    const filename = `premium-breakdown-${policyNumber}-${when.getTime()}.xlsx`;

    // Use ArrayBuffer for Response - ensure we get the right slice
    // Convert Uint8Array to ArrayBuffer for Response constructor
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    return new Response(arrayBuffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": bytes.byteLength.toString(),
        "X-Generation-Time": "0", // Will be replaced with actual time
        "X-Report-Type": "premiumWorkbook",
        "X-Report-Size": bytes.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Premium workbook generation failed:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate premium workbook",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * Health check handler
 */
async function handleHealthCheck(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const healthData = {
    status: "healthy",
    version: env.WORKER_VERSION || "1.0.0",
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(healthData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Info endpoint handler
 */
async function handleInfo(request: Request, env: WorkerEnv): Promise<Response> {
  const infoData = {
    service: "Excel Worker",
    version: env.WORKER_VERSION || "1.0.0",
    endpoints: ["/api/excel/generate", "/health", "/info"],
    capabilities: [
      "premiumWorkbook",
      "customReports",
      "formulaGeneration",
      "adjustmentCalculations",
    ],
  };

  return new Response(JSON.stringify(infoData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Generic Excel generation handler
 */
async function handleGenericExcel(
  request: Request,
  env: WorkerEnv,
  validatedData?: unknown,
): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Parse and validate request data
    let requestData: ExcelWorkerRequest;
    if (validatedData) {
      requestData = validatedData as ExcelWorkerRequest;
    } else {
      const body = await request.text();
      requestData = JSON.parse(body) as ExcelWorkerRequest;
    }

    // Validate that we have custom report data
    if (requestData.reportType !== "custom") {
      return new Response(
        JSON.stringify({ error: "Invalid report type, expected custom" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract custom report data
    const customData = requestData.data as z.infer<typeof customReportDataSchema>;
    const options = requestData.options || {};
    
    if (!customData || !customData.columns || !customData.rows) {
      return new Response(
        JSON.stringify({ error: "Invalid custom report data: columns and rows are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call generic Excel generation
    const { buildGenericExcelWorkbook } = await import("../services");
    const bytes = await buildGenericExcelWorkbook({
      columns: customData.columns,
      rows: customData.rows,
      sheetName: options.sheetName,
      title: options.title,
      formatCurrency: options.formatCurrency,
      includeTimestamp: options.includeTimestamp,
    });

    // Create filename
    const when = new Date();
    const filename = `custom-report-${when.getTime()}.xlsx`;
    const generationTime = Date.now() - startTime;

    // Convert Uint8Array to ArrayBuffer for Response constructor
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );

    return new Response(arrayBuffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": bytes.byteLength.toString(),
        "X-Generation-Time": generationTime.toString(),
        "X-Report-Type": "custom",
        "X-Report-Size": bytes.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Generic Excel generation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Generic Excel generation failed",
        message: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * Main route definitions
 */
export const routes: Route[] = [
  {
    method: "POST",
    path: "/api/excel/generate",
    schema: excelWorkerRequestSchema,
    handler: handleGeneratePremiumWorkbook,
    requireAuth: false,
    requireSignedRequest: false,
  },
  {
    method: "GET",
    path: "/health",
    handler: handleHealthCheck,
    requireAuth: false,
  },
  {
    method: "GET",
    path: "/info",
    handler: handleInfo,
    requireAuth: false,
  },
  {
    method: "POST",
    path: "/api/reports/excel",
    schema: excelWorkerRequestSchema,
    handler: handleGenericExcel,
    requireAuth: false,
    requireSignedRequest: false, // Backward compatibility
  },
];

/**
 * Match request to route
 */
export function matchRoute(request: Request): Route | null {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const route = routes.find(
    (route) => route.path === path && route.method === method,
  );

  return route || null;
}

/**
 * Handle OPTIONS (preflight) requests
 */
export function handleOptionsRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Service-Token",
      "Access-Control-Max-Age": "86400",
    },
  });
}
