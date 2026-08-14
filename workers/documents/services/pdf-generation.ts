// Document worker PDF generation service
import { generatePolicyPdf as appGeneratePolicyPdf } from "../../../app/lib/pdf/generate";
import type { CarWording, Policy } from "../../../app/lib/db/types";
import type { DocumentTemplate } from "../../../app/lib/pdf/templates";
import type { BrokerFeeLineInput } from "../../../app/lib/pdf/merge-fields";
import type { Font } from "@pdfme/common";

/**
 * Input for PDF generation
 */
export interface PdfGenerationInput {
  templateKey: string;
  policy: Policy;
  mergeInputs: Record<string, string | number | boolean>;
  template?: DocumentTemplate;
  wordingCatalogue?: CarWording[];
  brokerFeeLines?: BrokerFeeLineInput[];
  requestId: string;
}

/**
 * Result of PDF generation
 */
export interface PdfGenerationResult {
  pdf: Uint8Array;
  templateKey: string;
  inputs: Record<string, string>;
  byteLength: number;
}

/**
 * Generate a policy PDF with the given inputs
 * This wraps the existing app function for use in the document worker
 */
export async function generatePolicyPdf(
  templateKey: string,
  policy: Policy,
  mergeInputs: Record<string, string | number | boolean>,
  template?: DocumentTemplate,
  options?: {
    wordingCatalogue?: CarWording[];
    brokerFeeLines?: BrokerFeeLineInput[];
    font?: Font;
  },
): Promise<PdfGenerationResult> {
  // Convert mergeInputs to Record<string, string> for the app function
  const stringMergeInputs: Record<string, string> = {};
  if (mergeInputs) {
    for (const [key, value] of Object.entries(mergeInputs)) {
      stringMergeInputs[key] = String(value);
    }
  }

  // Call the existing app function
  const result = await appGeneratePolicyPdf(
    templateKey,
    policy,
    stringMergeInputs,
    template,
    {
      wordingCatalogue: options?.wordingCatalogue,
      brokerFeeLines: options?.brokerFeeLines,
      font: options?.font,
    },
  );

  return {
    pdf: result.pdf,
    templateKey: result.templateKey,
    inputs: result.inputs,
    byteLength: result.pdf.byteLength,
  };
}
