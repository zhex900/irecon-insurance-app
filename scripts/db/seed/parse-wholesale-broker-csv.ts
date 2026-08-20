/**
 * Parse legacy MSSQL WholesaleBroker.csv export into AR seed rows.
 * Skips SSMS separator / footer lines (dashes, "(N rows affected)").
 */

export type WholesaleBrokerCsvRow = {
  authorisedRepresentativeId: number;
  fullName: string;
  companyName: string;
  arNumber: string;
  mobilePhone: string;
  businessPhone: string;
  email: string;
  ownBroker: boolean;
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim().replace(/^\uFEFF/, ""));
}

export function parseWholesaleBrokerCsv(text: string): WholesaleBrokerCsvRow[] {
  const lines = text.split(/\r?\n/);
  const rows: WholesaleBrokerCsvRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const idRaw = cells[0] ?? "";
    if (!/^\d+$/.test(idRaw)) continue;

    const id = Number(idRaw);
    rows.push({
      authorisedRepresentativeId: id,
      fullName: (cells[2] ?? "").trim(),
      companyName: (cells[5] ?? "").trim(),
      arNumber: (cells[7] ?? "").trim(),
      mobilePhone: (cells[8] ?? "").trim(),
      businessPhone: (cells[9] ?? "").trim(),
      email: (cells[10] ?? "").trim(),
      ownBroker: (cells[11] ?? "0").trim() === "1",
    });
  }

  return rows;
}
