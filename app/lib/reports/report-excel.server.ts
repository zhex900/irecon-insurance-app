import type { ExcelServiceBinding } from "../excel/excel-service.server";

export type ReportExcelColumnType = "text" | "currency" | "integer" | "date";

export type ReportExcelColumn = {
  header: string;
  key: string;
  width?: number;
  type?: ReportExcelColumnType;
};

/** Build a single-sheet .xlsx workbook using Excel Worker. */
export async function buildReportExcelBuffer(
  excelService: ExcelServiceBinding,
  options: {
    sheetName?: string;
    /** Merged title row above column headers (e.g. report period). */
    title?: string;
    columns: ReportExcelColumn[];
    rows: Array<Record<string, string | number | null | undefined>>;
  },
): Promise<ArrayBuffer> {
  const { ...excelOptions } = options;

  // Prepare request data for Excel Worker
  const requestBody = {
    reportType: "custom" as const,
    data: {
      columns: excelOptions.columns.map((col) => ({
        key: col.key,
        header: col.header,
        type: col.type,
        width: col.width,
      })),
      rows: excelOptions.rows.map((row) => {
        const cleanRow: Record<string, string | number> = {};
        Object.entries(row).forEach(([key, value]) => {
          cleanRow[key] = value ?? "";
        });
        return cleanRow;
      }),
    },
    options: {
      title: excelOptions.title,
      sheetName: excelOptions.sheetName,
      formatCurrency: excelOptions.columns.some(
        (col) => col.type === "currency",
      ),
      includeTimestamp: true,
    },
  };

  try {
    // Call Excel service via service binding
    const response = await excelService.generateGenericExcel(requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Excel service failed: ${response.status} ${errorText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    throw new Error(
      `Failed to generate Excel report: ${error instanceof Error ? error.message : "Unknown error"}`,
      { cause: error },
    );
  }
}

export function reportExcelResponse(
  buffer: ArrayBuffer,
  filename: string,
): Response {
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
