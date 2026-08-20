/**
 * Write policy documents missing from POLICY_DOCUMENT_PATH(S) to CSV.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { LegacyPolicyDocumentRow } from "./legacy-payload.ts";
import { expectedLegacyDocumentPaths } from "./legacy-document-path.mts";

export type MissingPolicyDocumentRow = {
  policyDocumentId: number;
  policyId: number;
  policyNumber: string;
  documentTypeCode: string;
  documentName: string;
  filename: string;
  expectedPath: string;
};

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function missingPolicyDocumentRow(
  roots: string[],
  doc: LegacyPolicyDocumentRow,
): MissingPolicyDocumentRow {
  return {
    policyDocumentId: doc.policyDocumentId,
    policyId: doc.policyId,
    policyNumber: doc.policyNumber,
    documentTypeCode: doc.documentTypeCode,
    documentName: doc.documentName,
    filename: doc.filename,
    expectedPath: expectedLegacyDocumentPaths(roots, doc.filename),
  };
}

const CSV_HEADER =
  "policyDocumentId,policyId,policyNumber,documentTypeCode,documentName,filename,expectedPath";

export function writeMissingPolicyDocumentsCsv(
  path: string,
  rows: MissingPolicyDocumentRow[],
): void {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [
    CSV_HEADER,
    ...rows.map((row) =>
      [
        row.policyDocumentId,
        row.policyId,
        row.policyNumber,
        row.documentTypeCode,
        row.documentName,
        row.filename,
        row.expectedPath,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}
