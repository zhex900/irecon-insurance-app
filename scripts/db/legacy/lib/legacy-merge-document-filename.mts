/**
 * Legacy merge PDF filenames (Schedule / Rating / Adjustment).
 * Pattern: {prefix}_{policyNumber}_{amendmentNumber}_{yyyyMMdd HHmmss}.pdf
 * See _archive/specs/CAR_INSURANCE_APP_SPEC.md § document naming.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MERGE_FILENAME_RULES: {
  documentTypeCode: string;
  prefix: string;
}[] = [
  { documentTypeCode: "CARSCHED", prefix: "CAR_Schedule_" },
  { documentTypeCode: "CARRATING", prefix: "Car_Premium&ROA_" },
  { documentTypeCode: "CARADJUST", prefix: "CAR_Adjustment_" },
];

/** Match merge suffix: _{amendment}_{yyyyMMdd HHmmss} with optional extension */
const MERGE_SUFFIX = /^(.+)_(\d+)_(\d{8}) (\d{6})(?:\.pdf)?$/i;

export type ParsedMergeDocumentFilename = {
  documentTypeCode: string;
  policyNumberSegment: string;
  amendmentNumber: number;
  dateYmd: string;
  timeHms: string;
};

export function parseMergeDocumentFilename(
  documentTypeCode: string,
  filename: string,
): ParsedMergeDocumentFilename | null {
  const rule = MERGE_FILENAME_RULES.find(
    (r) => r.documentTypeCode === documentTypeCode,
  );
  if (!rule) return null;

  const base = filename.replace(/[/\\]/g, "_").trim();
  if (!base.startsWith(rule.prefix)) return null;

  const rest = base.slice(rule.prefix.length);
  const match = MERGE_SUFFIX.exec(rest);
  if (!match) return null;

  const [, policyNumberSegment, amendmentRaw, dateYmd, timeHms] = match;
  if (!policyNumberSegment || !amendmentRaw || !dateYmd || !timeHms) {
    return null;
  }

  return {
    documentTypeCode,
    policyNumberSegment,
    amendmentNumber: Number(amendmentRaw),
    dateYmd,
    timeHms,
  };
}

/** Stable local lookup key — ignores policy-number punctuation (ATCCW-79318 vs ATCCW79318). */
export function mergeDocumentLocalMatchKey(
  documentTypeCode: string,
  filename: string,
): string | null {
  const parsed = parseMergeDocumentFilename(documentTypeCode, filename);
  if (!parsed) return null;
  return [
    parsed.documentTypeCode,
    parsed.amendmentNumber,
    parsed.dateYmd,
    parsed.timeHms,
  ].join(":");
}

function walkPdfFiles(dir: string, out: string[]) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkPdfFiles(full, out);
    } else if (/\.pdf$/i.test(name)) {
      out.push(full);
    }
  }
}

/** Index merge PDFs on disk by amendment + timestamp (policy number variants ignored). */
export function buildLocalMergeDocumentIndex(
  roots: string[],
): Map<string, string> {
  const index = new Map<string, string>();
  const files: string[] = [];
  for (const root of roots) {
    walkPdfFiles(root, files);
  }

  for (const fullPath of files) {
    const base = fullPath.split(/[/\\]/).pop() ?? fullPath;
    for (const rule of MERGE_FILENAME_RULES) {
      const key = mergeDocumentLocalMatchKey(rule.documentTypeCode, base);
      if (!key || index.has(key)) continue;
      index.set(key, fullPath);
    }
  }

  return index;
}
