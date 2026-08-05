/**
 * Client-side CAR premium breakdown → Excel workbook.
 * Calculations on the Premium sheet are Excel formulas referencing Policy / Rates.
 *
 * Loaded via dynamic `import("exceljs")` only — never static-import into routes.
 */
import type {
  Policy,
  PolicyDocument,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";
import {
  adjustmentDocumentsFingerprint,
  reviewDocumentsFingerprint,
} from "~/lib/services/policy/documents/fingerprints";
import {
  formatDocTimestamp,
  makeDoc,
  nextAmendmentNumber,
  nextDocumentId,
} from "~/lib/services/policy/documents/content";
import {
  buildPremiumExcelWorkbook,
  PREMIUM_EXCEL_SPREADSHEET_VERSION,
  type BuildPremiumExcelInput,
} from "~/lib/pricing/premium-excel-build";

export const PREMIUM_EXCEL_TEMPLATE_KEY = "premium-breakdown-xlsx";

export { PREMIUM_EXCEL_SPREADSHEET_VERSION };
export type { BuildPremiumExcelInput };
export { buildPremiumExcelWorkbook };

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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
    PREMIUM_EXCEL_SPREADSHEET_VERSION,
    reviewDocumentsFingerprint(policy),
    policy.car.adjusted ? "adjusted" : "unadjusted",
    adjustmentDocumentsFingerprint(policy),
  ].join("|");
}

export async function buildPremiumExcelDocument(options: {
  policy: Policy;
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  generatedBy: string;
  existing: PolicyDocument[];
}): Promise<PolicyDocument> {
  const { policy, premium, rating, generatedBy, existing } = options;
  const bytes = await buildPremiumExcelWorkbook({
    policy,
    premium,
    rating,
    adjustment: policy.car.adjusted
      ? policy.car.adjustment?.breakdown
      : undefined,
    generatedBy,
  });
  const when = new Date();
  const stamp = formatDocTimestamp(when);
  const amendment = nextAmendmentNumber(existing, PREMIUM_EXCEL_TEMPLATE_KEY);
  const filename =
    amendment > 0
      ? `${policy.policyNumber}_Premium_${stamp}_A${amendment}.xlsx`
      : `${policy.policyNumber}_Premium_${stamp}.xlsx`;

  return {
    ...makeDoc({
      id: nextDocumentId(existing),
      policyId: policy.policyId,
      name: "Premium Excel",
      filename,
      generationKey: premiumExcelFingerprint(policy),
      content: `CAR premium breakdown spreadsheet v${PREMIUM_EXCEL_SPREADSHEET_VERSION} (formula-driven)`,
      generatedBy,
      generatedWhen: when.toISOString(),
      templateKey: PREMIUM_EXCEL_TEMPLATE_KEY,
    }),
    pdfBase64: uint8ToBase64(bytes),
  };
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
