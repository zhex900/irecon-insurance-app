/**
 * Parse legacy MSSQL Client.csv export into app client seed rows.
 * Skips SSMS separator / footer lines (dashes, "(N rows affected)").
 */

export type ClientCsvRow = {
  clientId: number;
  name: string;
  tradingName: string;
  abn: string;
  phone: string;
  email: string;
  accountManagerId: number;
  clientSourceId: number;
  createdWhen: Date | null;
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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = (raw ?? "").trim();
  if (!/^\d+$/.test(value)) return fallback;
  const n = Number(value);
  return n > 0 ? n : fallback;
}

/** MSSQL export dates like `2011-02-08 14:34:54.800` or `NULL`. */
function parseCreationDate(raw: string | undefined): Date | null {
  const value = (raw ?? "").trim();
  if (!value || /^null$/i.test(value) || value.startsWith("9999-")) {
    return null;
  }
  // Normalise space separator to ISO-ish for Date.parse
  const normalised = value.replace(" ", "T");
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Column order matches Client.csv header:
 * ClientId,ClientCode,ClientGuid,Name,TradingName,ABN,Phone,Fax,Mobile,Email,...
 * ClientSourceID @ 28, CreationDate @ 35 (0-based).
 */
export function parseClientCsv(text: string): ClientCsvRow[] {
  const lines = text.split(/\r?\n/);
  const rows: ClientCsvRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const idRaw = cells[0] ?? "";
    if (!/^\d+$/.test(idRaw)) continue;

    const phone = (cells[6] ?? "").trim() || (cells[8] ?? "").trim();
    const tradingName = (cells[4] ?? "").trim() || (cells[3] ?? "").trim();

    rows.push({
      clientId: Number(idRaw),
      name: (cells[3] ?? "").trim(),
      tradingName,
      abn: (cells[5] ?? "").trim(),
      phone,
      email: (cells[9] ?? "").trim(),
      accountManagerId: parsePositiveInt(cells[24], 1),
      clientSourceId: parsePositiveInt(cells[28], 16),
      createdWhen: parseCreationDate(cells[35]),
    });
  }

  return rows;
}
