import {
  formatCurrencyCell,
  loadExcelJS,
  styleWorkbookHeaderRow,
} from "~/lib/pricing/premium-excel-workbook";

export type ReportExcelColumnType = "text" | "currency" | "integer" | "date";

export type ReportExcelColumn = {
  header: string;
  key: string;
  width?: number;
  type?: ReportExcelColumnType;
};

/** Build a single-sheet .xlsx workbook (dynamic exceljs — server/API only). */
export async function buildReportExcelBuffer(options: {
  sheetName?: string;
  /** Merged title row above column headers (e.g. report period). */
  title?: string;
  columns: ReportExcelColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
}): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const hasTitle = Boolean(options.title?.trim());
  const headerRowIndex = hasTitle ? 2 : 1;
  const firstDataRowIndex = headerRowIndex + 1;

  const sheet = workbook.addWorksheet(options.sheetName ?? "Report", {
    views: [{ state: "frozen", ySplit: headerRowIndex }],
  });

  sheet.columns = options.columns.map((column) => ({
    key: column.key,
    width: column.width ?? Math.max(column.header.length + 2, 12),
  }));

  if (hasTitle) {
    sheet.mergeCells(1, 1, 1, options.columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = options.title;
    titleCell.font = { bold: true, size: 12 };
  }

  const headerRow = sheet.getRow(headerRowIndex);
  for (
    let columnIndex = 0;
    columnIndex < options.columns.length;
    columnIndex += 1
  ) {
    headerRow.getCell(columnIndex + 1).value =
      options.columns[columnIndex].header;
  }
  styleWorkbookHeaderRow(headerRow, options.columns.length);

  for (let rowIndex = 0; rowIndex < options.rows.length; rowIndex += 1) {
    const sheetRow = sheet.getRow(firstDataRowIndex + rowIndex);
    for (
      let columnIndex = 0;
      columnIndex < options.columns.length;
      columnIndex += 1
    ) {
      const column = options.columns[columnIndex];
      sheetRow.getCell(columnIndex + 1).value =
        options.rows[rowIndex][column.key] ?? "";
    }
  }

  for (let rowIndex = 0; rowIndex < options.rows.length; rowIndex += 1) {
    const sheetRow = sheet.getRow(firstDataRowIndex + rowIndex);
    for (
      let columnIndex = 0;
      columnIndex < options.columns.length;
      columnIndex += 1
    ) {
      const column = options.columns[columnIndex];
      const cell = sheetRow.getCell(columnIndex + 1);
      if (column.type === "currency") {
        formatCurrencyCell(cell);
      } else if (column.type === "integer") {
        cell.numFmt = "0";
        cell.alignment = { horizontal: "right" };
      } else if (column.type === "date") {
        cell.numFmt = "dd/mm/yyyy";
      }
    }
  }

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
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
