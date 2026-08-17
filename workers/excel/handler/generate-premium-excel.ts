import {
  CONTENT_TYPES,
  CUSTOM_HEADERS,
  MAX_REQUEST_SIZE_BYTES,
  REQUEST_TIMEOUT_MS,
} from "../constants/config";
import type { BuildPremiumExcelInput } from "../services/excel-types";
import { generatePremiumExcelRequestSchema } from "../types/schemas";
import {
  isPayloadTooLarge,
  jsonError,
  RequestTimeoutError,
  withTimeout,
} from "./request-guard";

function workbookResponse(
  bytes: Uint8Array,
  filename: string,
  generationTimeMs: number,
): Response {
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return new Response(arrayBuffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES.EXCEL,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": bytes.byteLength.toString(),
      [CUSTOM_HEADERS.GENERATION_TIME]: generationTimeMs.toString(),
      [CUSTOM_HEADERS.REPORT_TYPE]: "premiumWorkbook",
      [CUSTOM_HEADERS.REPORT_SIZE]: bytes.byteLength.toString(),
    },
  });
}

export async function generatePremiumExcel(
  requestData: unknown,
): Promise<Response> {
  if (isPayloadTooLarge(requestData, MAX_REQUEST_SIZE_BYTES)) {
    return jsonError("payload_too_large", 413);
  }

  const parsed = generatePremiumExcelRequestSchema.safeParse(requestData);
  if (!parsed.success) {
    return jsonError("Invalid premium workbook request", 400);
  }

  const started = Date.now();
  try {
    const { buildPremiumExcelWorkbook } = await import("../services");
    const input: BuildPremiumExcelInput = {
      policy: parsed.data.data.policy,
      premium: parsed.data.data.premium,
      rating: parsed.data.data.rating,
      adjustment: parsed.data.data.adjustment,
      generatedBy: parsed.data.options?.generatedBy || "Excel Worker",
    };

    const bytes = await withTimeout(
      buildPremiumExcelWorkbook(input),
      REQUEST_TIMEOUT_MS,
    );
    const policyNumber =
      parsed.data.options?.policyNumber ||
      parsed.data.data.policy.policyNumber ||
      "unknown";
    const filename = `premium-breakdown-${policyNumber}-${Date.now()}.xlsx`;
    return workbookResponse(bytes, filename, Date.now() - started);
  } catch (error) {
    if (error instanceof RequestTimeoutError) {
      return jsonError("Premium workbook generation timed out", 504);
    }
    console.error(
      "Premium workbook generation failed",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonError("Failed to generate premium workbook", 500);
  }
}
