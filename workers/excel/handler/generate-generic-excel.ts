import { CONTENT_TYPES, CUSTOM_HEADERS } from "../constants/config";
import {
  customReportDataSchema,
  generateGenericExcelRequestSchema,
} from "../types/schemas";

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function generateGenericExcel(
  requestData: unknown,
): Promise<Response> {
  const startTime = Date.now();
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

  try {
    const customData = customDataValidation.data;
    const options = parsed.data.options || {};
    const { buildGenericExcelWorkbook } = await import("../services");
    const bytes = await buildGenericExcelWorkbook({
      columns: customData.columns,
      rows: customData.rows,
      sheetName: options.sheetName,
      title: options.title,
      formatCurrency: options.formatCurrency,
      includeTimestamp: options.includeTimestamp,
    });

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
    console.error(
      "Generic Excel generation failed",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonError("Generic Excel generation failed", 500);
  }
}
