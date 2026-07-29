import type { Policy, PolicyDocument } from "~/lib/db/types";
import {
  libraryDocumentMatchesPolicy,
  type LibraryDocumentRecord,
} from "~/lib/library-documents";
import type { DocumentTemplateSlot } from "~/lib/pdf/templates";
import {
  formatDocTimestamp,
  makeDoc,
  nextAmendmentNumber,
} from "~/lib/services/policy/documents/content";
import {
  adjustmentDocumentsFingerprint,
  reviewDocumentsFingerprint,
} from "~/lib/services/policy/documents/fingerprints";
import { policyToMergeInputs } from "~/lib/pdf/merge-fields";

export type PackTemplateMeta = Pick<DocumentTemplateSlot, "key" | "title">;

/** Build the Review-stage document pack from published templates for the cover. */
export function buildReviewDocumentPack(
  policy: Policy,
  generatedBy: string,
  templates: PackTemplateMeta[],
  existing: PolicyDocument[] = [],
  libraryDocs?: LibraryDocumentRecord[],
): PolicyDocument[] {
  const generationKey = reviewDocumentsFingerprint(policy);
  const when = new Date();
  const stamp = formatDocTimestamp(when);
  const generatedWhen = when.toISOString();
  const mergeInputs = policyToMergeInputs(policy);
  let nextId = 1;

  const docs: PolicyDocument[] = templates.map((template) => {
    const amendment = nextAmendmentNumber(existing, template.key);
    const safeKey = template.key.replace(/[^a-zA-Z0-9_-]+/g, "_");
    return makeDoc({
      id: nextId++,
      policyId: policy.policyId,
      name: template.title || template.key,
      filename: `${safeKey}_${policy.policyNumber}_${amendment}_${stamp}.pdf`,
      generationKey,
      content: [
        template.title || template.key,
        `Policy number: ${policy.policyNumber}`,
        `Insured: ${policy.car.insuredName}`,
      ].join("\n"),
      generatedBy,
      generatedWhen,
      templateKey: template.key,
      mergeInputs,
    });
  });

  const libraryAttachments = resolveLibraryAttachments(policy, libraryDocs);
  for (const item of libraryAttachments) {
    docs.push(
      makeDoc({
        id: nextId++,
        policyId: policy.policyId,
        name: item.name,
        filename: item.filename,
        generationKey,
        content: item.content,
        generatedBy,
        generatedWhen,
        libraryDocumentId: item.libraryDocumentId,
      }),
    );
  }

  return docs;
}

type LibraryAttachment = {
  name: string;
  filename: string;
  content: string;
  libraryDocumentId?: number;
};

/** Prefer DB library docs; fall back to hardcoded seed filenames (no library ids). */
export function resolveLibraryAttachments(
  policy: Policy,
  libraryDocs?: LibraryDocumentRecord[],
): LibraryAttachment[] {
  if (libraryDocs && libraryDocs.length > 0) {
    return libraryDocs
      .filter((doc) => libraryDocumentMatchesPolicy(doc, policy))
      .map((doc) => ({
        name: doc.displayName,
        filename: doc.filename,
        libraryDocumentId: doc.libraryDocumentId,
        content: [
          doc.displayName,
          `Attached for policy ${policy.policyNumber}.`,
        ].join("\n"),
      }));
  }

  const items: LibraryAttachment[] = [];
  if (policy.stateId === 2) {
    items.push({
      name: "ATC Stamp duty Exemption",
      filename: "ATC Stamp duty Exemption.pdf",
      content: [
        "ATC Stamp Duty Exemption",
        `Policy number: ${policy.policyNumber}`,
        "Applicable because the risk state is New South Wales.",
      ].join("\n"),
    });
  }
  items.push(
    {
      name: "Policy Comparison",
      filename: "POLICY COMPARISON JUNE 2024.pdf",
      content: [
        "Policy Comparison — June 2024",
        `Attached for policy ${policy.policyNumber}.`,
      ].join("\n"),
    },
    {
      name: "IA Annual CAR TPL Wording",
      filename: "IA Annual CAR TPL Wording (eff Jan 2026) - Sample.pdf",
      content: [
        "IA Annual CAR TPL Wording (effective January 2026)",
        `Wording attached for policy ${policy.policyNumber}.`,
      ].join("\n"),
    },
  );
  return items;
}

/**
 * Pack generated when an adjustment is saved:
 * all published templates for the cover (typically includes adjustment + schedule + rating).
 */
export function buildAdjustmentDocumentPack(
  policy: Policy,
  generatedBy: string,
  templates: PackTemplateMeta[],
  existing: PolicyDocument[] = [],
): PolicyDocument[] {
  if (!policy.car.adjustment || !policy.car.premium) return [];

  const generationKey = adjustmentDocumentsFingerprint(policy);
  const when = new Date();
  const stamp = formatDocTimestamp(when);
  const generatedWhen = when.toISOString();
  const mergeInputs = policyToMergeInputs(policy);
  let nextId = 1;

  return templates.map((template) => {
    const amendment = nextAmendmentNumber(existing, template.key);
    const safeKey = template.key.replace(/[^a-zA-Z0-9_-]+/g, "_");
    return makeDoc({
      id: nextId++,
      policyId: policy.policyId,
      name: template.title || template.key,
      filename: `${safeKey}_${policy.policyNumber}_${amendment}_${stamp}.pdf`,
      generationKey,
      content: [
        template.title || template.key,
        `Policy number: ${policy.policyNumber}`,
        `Insured: ${policy.car.insuredName}`,
      ].join("\n"),
      generatedBy,
      generatedWhen,
      templateKey: template.key,
      mergeInputs,
    });
  });
}
