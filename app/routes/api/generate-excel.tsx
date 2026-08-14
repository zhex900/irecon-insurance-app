import type { ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth/session.server";
import { buildPremiumExcelWorkbook as workerBuild } from "~/lib/reports/excel-worker-wrapper.server";
import {
  PREMIUM_EXCEL_TEMPLATE_KEY,
  PREMIUM_EXCEL_FILENAME_PREFIX,
} from "~/lib/excel/constants";
import { cloudflareContext } from "~/lib/cloudflare.server";

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Require authentication for this API endpoint
  const _user = await requireAuth(request);

  try {
    const body = await request.json();
    const { env } = context.get(cloudflareContext);
    const excelService = env.EXCEL_SERVICE;

    if (!excelService) {
      return Response.json(
        { error: "Excel service not found" },
        { status: 500 },
      );
    }

    const { policy, premium, rating, generatedBy, existing } = body;

    // Always use Excel worker for generation
    // The worker wrapper handles calling the external Excel worker service
    const bytes = await workerBuild(excelService, {
      policy,
      premium,
      rating,
      adjustment: policy.car.adjusted
        ? policy.car.adjustment?.breakdown
        : undefined,
      generatedBy,
    });

    const when = new Date();
    // Calculate amendment from existing documents
    const existingExcelDocs = (existing || []).filter(
      (doc: { templateKey?: string; filename?: string }) =>
        doc.templateKey === PREMIUM_EXCEL_TEMPLATE_KEY ||
        /\.xlsx$/i.test(doc.filename ?? ""),
    );
    const amendment = existingExcelDocs.length;
    const filename = `${PREMIUM_EXCEL_FILENAME_PREFIX}-${policy.policyNumber ?? policy.policyId}${`-v${amendment + 1}`}.xlsx`;

    // Convert to base64
    let contentBase64;
    if (typeof Buffer !== "undefined") {
      contentBase64 = Buffer.from(bytes).toString("base64");
    } else {
      contentBase64 = btoa(String.fromCharCode(...bytes));
    }

    const doc = {
      policyDocumentId: 0, // Placeholder - actual ID assigned by database
      policyId: policy.policyId,
      name: filename.replace(".xlsx", ""),
      filename,
      generationKey: `excel|${policy.policyId}|${policy.car.adjusted ? "adjusted" : "unadjusted"}`,
      content: contentBase64,
      templateKey: PREMIUM_EXCEL_TEMPLATE_KEY,
      generatedWhen: when.toISOString(),
      generatedBy,
      pdfBase64: contentBase64,
    };

    // Return the document data
    return Response.json({
      success: true,
      document: doc,
      mode: "worker", // Always use worker mode now
    });
  } catch (error) {
    console.error("Excel generation failed:", error);
    return Response.json(
      {
        error: "Failed to generate Excel document",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
