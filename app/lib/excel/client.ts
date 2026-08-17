/**
 * Client-side CAR premium breakdown → Excel workbook utilities.
 * Client-only functions for working with premium Excel documents.
 */

import type { PolicyDocument } from "~/lib/db/types";

import { EXCEL_CONTENT_TYPE,PREMIUM_EXCEL_TEMPLATE_KEY } from "./constants";

export function isPremiumExcelDocument(doc: PolicyDocument): boolean {
  return (
    doc.templateKey === PREMIUM_EXCEL_TEMPLATE_KEY ||
    /\.xlsx$/i.test(doc.filename)
  );
}

/** Trigger a browser download from a stored excel PolicyDocument. */
export function downloadPremiumExcelDocument(doc: {
  filename: string;
  pdfBase64?: string;
}) {
  if (!doc.pdfBase64) {
    throw new Error("Excel file is not available on this document");
  }
  const binary = atob(doc.pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const blob = new Blob([bytes], {
    type: EXCEL_CONTENT_TYPE,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = doc.filename.endsWith(".xlsx")
    ? doc.filename
    : `${doc.filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Firefox/Safari may still be consuming the object URL after click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
