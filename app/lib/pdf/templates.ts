import {
  BLANK_A4_PDF,
  isBlankPdf,
  resolvePageSize,
  type Template,
} from "@pdfme/common";

import type { FlowPushDown } from "~/lib/pdf/flow-push-down";

export type DocumentPageOrientation = "portrait" | "landscape";

const BLANK_PADDING = [10, 10, 10, 10] as [number, number, number, number];

/** Blank A4 portrait canvas — no static PDF chrome; all content is editable schemas. */
export const DOCUMENT_TEMPLATE_BLANK_BASE_PDF = BLANK_A4_PDF;

/** Blank A4 landscape canvas (297 × 210 mm). */
export const DOCUMENT_TEMPLATE_BLANK_LANDSCAPE_PDF = {
  ...resolvePageSize("A4", "landscape"),
  padding: BLANK_PADDING,
};

/** Blank page background for the given orientation. */
export function blankBasePdfForOrientation(
  orientation: DocumentPageOrientation,
) {
  return orientation === "landscape"
    ? DOCUMENT_TEMPLATE_BLANK_LANDSCAPE_PDF
    : DOCUMENT_TEMPLATE_BLANK_BASE_PDF;
}

/** Detect portrait vs landscape from a pdfme blank `basePdf`. */
export function getTemplateOrientation(
  template: Template,
): DocumentPageOrientation {
  const base = template.basePdf;
  if (isBlankPdf(base) && base.width > base.height) return "landscape";
  return "portrait";
}

/**
 * Ensure a blank page background so only schema fields appear.
 * Preserves the template's current orientation unless overridden.
 */
export function withBlankPageBackground(
  template: Template,
  orientation: DocumentPageOrientation = getTemplateOrientation(template),
): Template {
  return {
    ...template,
    basePdf: blankBasePdfForOrientation(orientation),
  };
}

/** Switch the blank canvas between portrait and landscape A4. */
export function withPageOrientation(
  template: Template,
  orientation: DocumentPageOrientation,
): Template {
  return withBlankPageBackground(template, orientation);
}

/** Published or editable pdfme template resolved from Postgres. */
export type DocumentTemplate = {
  key: string;
  coverTypeId: number | null;
  title: string;
  /** Short label for policy documents side card (max 20). */
  label: string;
  versionNumber: number;
  mergeFields: string[];
  flowPushDown?: FlowPushDown | null;
  template: Template;
};
