import type { ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth/session.server";
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
  const user = await requireAuth(request);

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

    const { policy, premium, rating, generatedBy: requestGeneratedBy } = body;
    const generatedBy = requestGeneratedBy || user.userId;

    // Call Excel service directly using RPC
    const excelResponse = await excelService.generatePremiumExcel({
      reportType: "premiumWorkbook",
      data: {
        policy,
        premium,
        rating,
        adjustment: policy.car.adjusted
          ? policy.car.adjustment?.breakdown
          : undefined,
      },
      options: {
        policyNumber: policy.policyNumber,
        generatedBy,
      },
    });

    if (!excelResponse.ok) {
      const errorText = await excelResponse.text();
      throw new Error(
        `Excel service failed: ${excelResponse.status} ${errorText}`,
      );
    }

    // Get the Excel file bytes from the response
    const bytes = await excelResponse.arrayBuffer();

    const when = new Date();

    const filename = `${PREMIUM_EXCEL_FILENAME_PREFIX}-${policy.policyNumber ?? policy.policyId}.xlsx`;

    // Convert to base64 for database (optional, could store R2 key only)
    let contentBase64;
    if (typeof Buffer !== "undefined") {
      contentBase64 = Buffer.from(bytes).toString("base64");
    } else {
      const uint8Array = new Uint8Array(bytes);
      contentBase64 = btoa(String.fromCharCode(...uint8Array));
    }

    const doc = {
      policyDocumentId: 0, // Placeholder - actual ID assigned by database
      policyId: policy.policyId,
      name: filename.replace(".xlsx", ""),
      filename,
      generationKey: `excel|${policy.policyId}|${policy.car.adjusted ? "adjusted" : "unadjusted"}`,
      content: contentBase64, // Still store base64 in database for backward compatibility
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
