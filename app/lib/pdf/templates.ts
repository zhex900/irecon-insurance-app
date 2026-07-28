import type { Template } from "@pdfme/common";
import type { PolicyDocumentTypeCode } from "~/lib/db/types";
import type { FlowPushDown } from "~/lib/pdf/flow-push-down";

import adjustment from "~/assets/pdf-templates/adjustment.json";
import ratingAnnual from "~/assets/pdf-templates/rating-annual.json";
import ratingOwnerBuilder from "~/assets/pdf-templates/rating-owner-builder.json";
import ratingSingle from "~/assets/pdf-templates/rating-single.json";
import scheduleAnnual from "~/assets/pdf-templates/schedule-annual.json";
import scheduleOwnerBuilder from "~/assets/pdf-templates/schedule-owner-builder.json";
import scheduleSingle from "~/assets/pdf-templates/schedule-single.json";

export type PdfTemplateSlot = {
  key: string;
  documentTypeCode: PolicyDocumentTypeCode;
  coverTypeId: number | null;
  title: string;
  sourceFile: string;
  versionNumber: number;
  mergeFields: string[];
  flowPushDown?: FlowPushDown | null;
  template: Template;
};

const SLOTS: PdfTemplateSlot[] = [
  scheduleAnnual,
  scheduleSingle,
  scheduleOwnerBuilder,
  ratingAnnual,
  ratingSingle,
  ratingOwnerBuilder,
  adjustment,
] as unknown as PdfTemplateSlot[];

export function resolvePdfTemplate(
  documentTypeCode: PolicyDocumentTypeCode,
  coverTypeId: number,
): PdfTemplateSlot | null {
  if (documentTypeCode === "CARADDIT") return null;
  if (documentTypeCode === "CARADJUST") {
    return SLOTS.find((s) => s.documentTypeCode === "CARADJUST") ?? null;
  }
  return (
    SLOTS.find(
      (s) =>
        s.documentTypeCode === documentTypeCode &&
        s.coverTypeId === coverTypeId,
    ) ??
    SLOTS.find(
      (s) => s.documentTypeCode === documentTypeCode && s.coverTypeId === 1,
    ) ??
    null
  );
}

export function listPdfTemplateSlots() {
  return SLOTS.map(
    ({ key, documentTypeCode, coverTypeId, title, sourceFile }) => ({
      key,
      documentTypeCode,
      coverTypeId,
      title,
      sourceFile,
    }),
  );
}

/** Static library PDFs copied from car-pdf-templates/ into public/. */
export const LIBRARY_DOCUMENT_PATHS: Record<string, string> = {
  "ATC Stamp duty Exemption.pdf":
    "/library-documents/ATC%20Stamp%20duty%20Exemption.pdf",
  "POLICY COMPARISON JUNE 2024.pdf":
    "/library-documents/POLICY%20COMPARISON%20JUNE%202024.pdf",
  "IA Annual CAR TPL Wording (eff Jan 2026) - Sample.pdf":
    "/library-documents/IA%20Annual%20CAR%20TPL%20Wording%20(eff%20Jan%202026)%20-%20Sample.pdf",
};
