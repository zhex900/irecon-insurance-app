import type { ExcelWorkerEnv } from "../types/env";
import type {
  AdjustmentBreakdown,
  Policy,
  PremiumBreakdown,
  RatingSnapshot,
} from "../../../app/lib/db/types";

import type { BuildPremiumExcelInput } from "../services/excel-types";

export async function generatePremiumExcel(
  requestData: {
    reportType: string;
    data: {
      policy: Policy;
      premium: PremiumBreakdown;
      rating?: RatingSnapshot;
      adjustment?: AdjustmentBreakdown;
    };
    options?: Record<string, unknown>;
  },
  env: ExcelWorkerEnv,
): Promise<Response> {
  try {
    // Import services dynamically to avoid initial load time
    const { buildPremiumExcelWorkbook } = await import("../services");

    // Validate that we have premium workbook data
    if (requestData.reportType !== "premiumWorkbook") {
      return new Response(
        JSON.stringify({
          error:
            "Invalid report type, expected premiumWorkbook, got " +
            requestData.reportType +
            " " +
            JSON.stringify(requestData),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
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
