const CURRENCY = '"$"#,##0.00';
const PERCENT = "0.0000%";

export function formatCurrencyCell(cell: import("exceljs").Cell) {
  cell.numFmt = CURRENCY;
  cell.alignment = { horizontal: "right" };
}

export function styleWorkbookHeaderRow(
  row: import("exceljs").Row,
  columns: number,
) {
  for (let column = 1; column <= columns; column += 1) {
    const cell = row.getCell(column);
    cell.font = { bold: true, size: 11 };
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}

/** Round money formulas to cents so Excel totals match summed line items. */
export function setMoneyCell(
  cell: import("exceljs").Cell,
  formula?: string,
  value = 0,
) {
  cell.value = formula
    ? { formula: `ROUND(${formula},2)`, result: value }
    : value;
  formatCurrencyCell(cell);
}

/** Match app `roundRate` (6 dp) so adjustment taxes don't drift from the UI. */
export function setPercentCell(
  cell: import("exceljs").Cell,
  value: number,
  formula?: string,
  options?: { roundRate?: boolean },
) {
  if (formula) {
    const expression =
      options?.roundRate === false ? formula : `ROUND(${formula},6)`;
    cell.value = { formula: expression, result: value };
  } else {
    cell.value = value;
  }
  cell.numFmt = PERCENT;
  cell.alignment = { horizontal: "right" };
}
