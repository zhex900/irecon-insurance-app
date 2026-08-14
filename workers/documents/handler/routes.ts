// Document worker route definitions
import { z } from "zod";
import type { DocumentWorkerEnv } from "../types/env";
import { pdfRenderRequestSchema, type PdfRenderRequest, PDF_RENDER_PATH } from "../types/schemas";
import { generatePolicyPdf } from "../services/pdf-generation";
import { getDocumentWorkerFonts } from "../services/font-management";

/**
 * Route handler interface
 */
export interface Route<T> {
  method: string;
  path: string;
  schema: z.ZodSchema<T> | null; // Zod schema for validation
  handler: (
    request: Request,
    env: DocumentWorkerEnv,
    validatedData: T,
  ) => Promise<Response>;
}

/**
 * PDF render endpoint handler
 */
async function handlePdfRender(
  _request: Request,
  env: DocumentWorkerEnv,
  validatedData: PdfRenderRequest,
): Promise<Response> {
  try {
    const result = await generatePolicyPdf(
      validatedData.templateKey,
      validatedData.policy,
      validatedData.mergeInputs,
      validatedData.template,
      {
        wordingCatalogue: validatedData.wordingCatalogue,
        brokerFeeLines: validatedData.brokerFeeLines,
        font: await getDocumentWorkerFonts(env.ASSETS),
      },
    );

    return new Response(Uint8Array.from(result.pdf).buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(result.byteLength),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-request-id": validatedData.requestId,
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "document.render_failed",
        requestId: validatedData.requestId,
        error: error instanceof Error ? error.message : "unknown_error",
      }),
    );

    return Response.json(
      {
        error: "render_failed",
        requestId: validatedData.requestId,
      },
      { status: 500 },
    );
  }
}

/**
 * Health check endpoint handler
 */
async function handleHealthCheck(
  _request: Request,
  _env: DocumentWorkerEnv,
  _validatedData: unknown,
): Promise<Response> {
  const healthCheck = {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    service: "document-worker",
  };

  return Response.json(healthCheck, {
    headers: {
      "cache-control": "no-store",
    },
  });
}

/**
 * Route type for health check endpoints (no request body)
 */
interface HealthCheckRoute {
  method: string;
  path: string;
  schema: null;
  handler: (
    request: Request,
    env: DocumentWorkerEnv,
    validatedData: null,
  ) => Promise<Response>;
}

/**
 * Route type for info endpoint (no request body)
 */
interface InfoRoute {
  method: string;
  path: string;
  schema: null;
  handler: (
    request: Request,
    env: DocumentWorkerEnv,
    validatedData: null,
  ) => Promise<Response>;
}

/**
 * Route type for PDF render endpoint
 */
interface PdfRenderRoute {
  method: string;
  path: string;
  schema: z.ZodSchema<PdfRenderRequest>;
  handler: (
    request: Request,
    env: DocumentWorkerEnv,
    validatedData: PdfRenderRequest,
  ) => Promise<Response>;
}

/**
 * Union type for all routes
 */
type AppRoute = PdfRenderRoute | HealthCheckRoute | InfoRoute;

/**
 * Document worker route definitions
 */
export const routes: AppRoute[] = [
  {
    method: "POST",
    path: PDF_RENDER_PATH,
    schema: pdfRenderRequestSchema,
    handler: handlePdfRender,
  } as PdfRenderRoute,
  {
    method: "GET",
    path: "/health",
    schema: null, // No request body for health check
    handler: handleHealthCheck,
  } as HealthCheckRoute,
  {
    method: "GET",
    path: "/info",
    schema: null, // No request body for info
    handler: async (_request, _env, _validatedData) => {
      const info = {
        service: "document-worker",
        version: "1.0.0",
        endpoints: [
          {
            path: PDF_RENDER_PATH,
            method: "POST",
            description: "Generate PDF",
          },
          { path: "/health", method: "GET", description: "Health check" },
          { path: "/info", method: "GET", description: "Service info" },
        ],
      };

      return Response.json(info);
    },
  } as InfoRoute,
];

/**
 * Find route handler for the given request
 */
export function findRoute(method: string, path: string): AppRoute | undefined {
  return routes.find((route) => route.method === method && route.path === path);
}
