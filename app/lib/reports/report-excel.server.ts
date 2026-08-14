export type ReportExcelColumnType = "text" | "currency" | "integer" | "date";

export type ReportExcelColumn = {
  header: string;
  key: string;
  width?: number;
  type?: ReportExcelColumnType;
};

/** Build a single-sheet .xlsx workbook using Excel Worker. */
export async function buildReportExcelBuffer(options: {
  sheetName?: string;
  /** Merged title row above column headers (e.g. report period). */
  title?: string;
  columns: ReportExcelColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
}): Promise<ArrayBuffer> {
  // Always use Excel Worker wrapper
  const { buildReportExcelBuffer: excelWorkerBuild } =
    await import("./excel-worker-wrapper.server");

  return excelWorkerBuild(options);
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
