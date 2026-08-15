import {
  type ExcelWorkerRequest,
  customReportDataSchema,
} from "../types/schemas";

/**
 * Generic Excel generation handler
 */
export async function generateGenericExcel(
  requestData: ExcelWorkerRequest,
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Parse and validate request data

    // Validate that we have custom report data
    if (requestData.reportType !== "custom") {
      return new Response(
        JSON.stringify({ error: "Invalid report type, expected custom" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Extract and validate custom report data
    const customDataValidation = customReportDataSchema.safeParse(
      requestData.data,
    );
    if (!customDataValidation.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid custom report data format",
          details: customDataValidation.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const customData = customDataValidation.data;
    const options = requestData.options || {};

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
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": bytes.byteLength.toString(),
        "X-Generation-Time": generationTime.toString(),
        "X-Report-Type": "custom",
        "X-Report-Size": bytes.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Generic Excel generation failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Generic Excel generation failed",
        message: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
