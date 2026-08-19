import {
  CONTENT_TYPES,
  CUSTOM_HEADERS,
  MAX_REQUEST_SIZE_BYTES,
  REQUEST_TIMEOUT_MS,
} from "../constants/config";
import {
  customReportDataSchema,
  generateGenericExcelRequestSchema,
} from "../types/schemas";
import {
  isPayloadTooLarge,
  jsonError,
  RequestTimeoutError,
  withTimeout,
} from "./request-guard";

export async function generateGenericExcel(
  requestData: unknown,
): Promise<Response> {
  if (isPayloadTooLarge(requestData, MAX_REQUEST_SIZE_BYTES)) {
    return jsonError("payload_too_large", 413);
  }

  const parsed = generateGenericExcelRequestSchema.safeParse(requestData);
  if (!parsed.success) {
    return jsonError("Invalid custom report request", 400);
  }

  const customDataValidation = customReportDataSchema.safeParse(
    parsed.data.data,
  );
  if (!customDataValidation.success) {
    return jsonError("Invalid custom report data format", 400);
  }

  const startTime = Date.now();
  try {
    const customData = customDataValidation.data;
    const options = parsed.data.options || {};
    const { buildGenericExcelWorkbook } = await import("../services");
    const bytes = await withTimeout(
      buildGenericExcelWorkbook({
        columns: customData.columns,
        rows: customData.rows,
        sheetName: options.sheetName,
        title: options.title,
        formatCurrency: options.formatCurrency,
        includeTimestamp: options.includeTimestamp,
      }),
      REQUEST_TIMEOUT_MS,
    );

    const filename = `custom-report-${Date.now()}.xlsx`;
    const generationTime = Date.now() - startTime;
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
        [CUSTOM_HEADERS.GENERATION_TIME]: generationTime.toString(),
        [CUSTOM_HEADERS.REPORT_TYPE]: "custom",
        [CUSTOM_HEADERS.REPORT_SIZE]: bytes.byteLength.toString(),
      },
    });
  } catch (error) {
    if (error instanceof RequestTimeoutError) {
      return jsonError("Generic Excel generation timed out", 504);
    }
    console.error(
      "Generic Excel generation failed",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonError("Generic Excel generation failed", 500);
  }
}
