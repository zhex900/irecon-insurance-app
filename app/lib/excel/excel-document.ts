import type {
  Policy,
  PolicyDocument,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";
import { buildPremiumExcelWorkbook } from "~/lib/reports/excel-worker-wrapper.server";
import { PREMIUM_EXCEL_TEMPLATE_KEY } from "./constants";
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
import { PREMIUM_EXCEL_FILENAME_PREFIX } from "./constants";

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
  const filename = `${PREMIUM_EXCEL_FILENAME_PREFIX}-${policy.policyNumber ?? policy.policyId}${`-v${amendment + 1}`}.xlsx`;

  // Convert Uint8Array to base64 string for content field
  // downloadPremiumExcelDocument expects pdfBase64, which we'll also set
  let contentBase64;
  if (typeof Buffer !== "undefined") {
    // Node.js environment
    contentBase64 = Buffer.from(bytes).toString("base64");
  } else {
    // Browser environment or other
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    contentBase64 = btoa(binary);
  }

  const doc = makeDoc({
    id: nextDocumentId(existing),
    policyId: policy.policyId,
    name: filename.replace(".xlsx", ""),
    filename,
    generationKey: [
      "excel",
      policy.policyId,
      reviewDocumentsFingerprint(policy),
      policy.car.adjusted ? "adjusted" : "unadjusted",
      adjustmentDocumentsFingerprint(policy),
    ].join("|"),
    content: contentBase64,
    generatedBy,
    generatedWhen: stamp,
    templateKey: PREMIUM_EXCEL_TEMPLATE_KEY,
  });

  // Add pdfBase64 for download function
  // TypeScript will complain but it's needed for downloadPremiumExcelDocument
  return {
    ...doc,
    pdfBase64: contentBase64,
  } as PolicyDocument & { pdfBase64: string };
}
