/**
 * Generic Excel report generation
 * Worker-compatible version for simple column/row based reports
 */

import { loadExcelJS, formatCurrencyCell, styleWorkbookHeaderRow } from "./excel-workbook";

export interface GenericExcelColumn {
  key: string;
  header: string;
  width?: number;
  type?: "text" | "currency" | "integer" | "date";
}

export interface GenericExcelInput {
  columns: GenericExcelColumn[];
  rows: Array<Record<string, string | number>>;
  sheetName?: string;
  title?: string;
  formatCurrency?: boolean;
  includeTimestamp?: boolean;
}

/** Build a simple .xlsx workbook with columns and rows. */
export async function buildGenericExcelWorkbook(
  input: GenericExcelInput,
): Promise<Uint8Array> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Irecon Insurance";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetName = input.sheetName || "Report";
  const worksheet = workbook.addWorksheet(sheetName);

  // Set column widths if provided
  input.columns.forEach((col, index) => {
    const colIndex = index + 1;
    const column = worksheet.getColumn(colIndex);
    if (col.width) {
      column.width = col.width;
    }
  });

  // Add title row if provided
  let rowIndex = 1;
  if (input.title) {
    const titleRow = worksheet.addRow([input.title]);
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A${rowIndex}:${String.fromCharCode(64 + input.columns.length)}${rowIndex}`);
    rowIndex++;
  }

  // Add header row
  const headers = input.columns.map(col => col.header);
  const headerRow = worksheet.addRow(headers);
  styleWorkbookHeaderRow(headerRow, input.columns.length);
  rowIndex++;

  // Add data rows
  for (const rowData of input.rows) {
    const rowValues = input.columns.map(col => rowData[col.key] ?? "");
    const row = worksheet.addRow(rowValues);
    
    // Apply formatting based on column type
    input.columns.forEach((col, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      
      switch (col.type) {
        case "currency":
          if (input.formatCurrency !== false) {
            formatCurrencyCell(cell);
          }
          break;
        case "integer":
          cell.numFmt = "0";
          cell.alignment = { horizontal: "right" };
          break;
        case "date":
          cell.numFmt = "yyyy-mm-dd";
          break;
        default:
          // Text formatting
          cell.alignment = { vertical: "top", wrapText: true };
      }
    });
    
    rowIndex++;
  }

  // Auto-fit columns if width not specified
  input.columns.forEach((col, index) => {
    if (!col.width) {
      const column = worksheet.getColumn(index + 1);
      column.width = Math.max(col.header.length * 1.2, 10);
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}