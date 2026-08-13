/**
 * Client-side CAR premium breakdown → Excel workbook utilities.
 * Client-only functions for working with premium Excel documents.
 */

import type { Policy, PolicyDocument } from "~/lib/db/types";
import {
  adjustmentDocumentsFingerprint,
  reviewDocumentsFingerprint,
} from "~/lib/services/policy/documents/fingerprints";

export const PREMIUM_EXCEL_TEMPLATE_KEY = "premium-breakdown-xlsx";

export function isPremiumExcelDocument(doc: PolicyDocument): boolean {
  return (
    doc.templateKey === PREMIUM_EXCEL_TEMPLATE_KEY ||
    /\.xlsx$/i.test(doc.filename)
  );
}

export function latestPremiumExcelDocument(
  documents: PolicyDocument[],
): PolicyDocument | undefined {
  return [...documents]
    .filter(isPremiumExcelDocument)
    .sort((a, b) => b.policyDocumentId - a.policyDocumentId)[0];
}

export function premiumExcelExportEnabled(
  documents: PolicyDocument[],
  fingerprint: string,
): boolean {
  const latest = latestPremiumExcelDocument(documents);
  if (!latest) return true;
  const base = latest.generationKey.split("|force|")[0] ?? latest.generationKey;
  return base !== fingerprint;
}

export function premiumExcelFingerprint(policy: Policy): string {
  // Include adjustment so a post-bind adjust forces a new workbook with the Adjustment tab.
  return [
    "excel",
    reviewDocumentsFingerprint(policy),
    policy.car.adjusted ? "adjusted" : "unadjusted",
    adjustmentDocumentsFingerprint(policy),
  ].join("|");
}

/** Trigger a browser download from a stored excel PolicyDocument. */
export function downloadPremiumExcelDocument(doc: PolicyDocument) {
  if (!doc.pdfBase64) {
    throw new Error("Excel file is not available on this document");
  }
  const binary = atob(doc.pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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