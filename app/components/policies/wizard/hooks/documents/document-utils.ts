import type { RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  CarWording,
  Policy,
  PolicyDocument,
  PremiumBreakdown,
} from "~/lib/db/types";
import type { BrokerFeeLineInput } from "~/lib/pdf/merge-fields";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export type UsePolicyDocumentsProps = {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  premium: PremiumBreakdown | undefined;
  premiumRef: RefObject<PremiumBreakdown | undefined>;
  premiumManualKeysRef: RefObject<string[]>;
  referralReasons: string[];
  rating: Policy["car"]["rating"] | undefined;
  carWording?: CarWording[];
  brokerFeeLines?: BrokerFeeLineInput[];
};

export type RegenerateDocumentsOptions = {
  cancelled?: () => boolean;
  premiumOverride?: PremiumBreakdown;
  force?: boolean;
  replaceCoverPack?: boolean;
};

export type ExcelExportDocument = {
  filename: string;
  pdfBase64?: string;
};

export function parseExcelExportResponse(
  result: unknown,
  responseOk: boolean,
): ExcelExportDocument {
  const errorMessage =
    result &&
    typeof result === "object" &&
    "error" in result &&
    typeof result.error === "string"
      ? result.error
      : "Failed to generate Excel";
  const document =
    result &&
    typeof result === "object" &&
    "document" in result &&
    result.document &&
    typeof result.document === "object"
      ? result.document
      : null;
  if (!responseOk || !document) {
    throw new Error(errorMessage);
  }
  if (!("filename" in document) || typeof document.filename !== "string") {
    throw new Error("Failed to generate Excel");
  }
  return {
    filename: document.filename,
    pdfBase64:
      "pdfBase64" in document && typeof document.pdfBase64 === "string"
        ? document.pdfBase64
        : undefined,
  };
}

export function latestDocumentGenerationKey(
  documents: PolicyDocument[],
): string | undefined {
  const latestKey = [...documents]
    .reverse()
    .find((doc) => Boolean(doc.templateKey))?.generationKey;
  if (!latestKey) return undefined;
  return latestKey.split("|force|")[0] ?? latestKey;
}
