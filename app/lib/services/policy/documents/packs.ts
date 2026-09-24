import type { Policy, PolicyDocument } from "~/lib/db/types";
import { formatDocumentLabel } from "~/lib/documents/document-label";
import {
  libraryDocumentMatchesPolicy,
  type LibraryDocumentRecord,
} from "~/lib/documents/library-documents";
import type { BrokerFeeLineInput } from "~/lib/pdf/merge-fields";
import type { DocumentTemplate } from "~/lib/pdf/templates";
import { policyDisplayNumber } from "~/lib/policies/policy-display";
import {
  formatDocTimestamp,
  makeDoc,
  nextAmendmentNumber,
} from "~/lib/services/policy/documents/content";
import {
  adjustmentDocumentsFingerprint,
  reviewDocumentsFingerprint,
} from "~/lib/services/policy/documents/fingerprints";

export type PackTemplateMeta = Pick<
  DocumentTemplate,
  "key" | "title" | "label"
>;

function packTemplateLabel(template: PackTemplateMeta): string {
  return (
    formatDocumentLabel(template.label) ||
    formatDocumentLabel(template.title) ||
    template.key
  );
}

/**
 * Refresh stored document names from current library / template labels.
 * Returns the same array reference when nothing changed.
 */
export function syncPolicyDocumentLabels(
  documents: PolicyDocument[],
  options: {
    libraryDocs?: LibraryDocumentRecord[];
    templates?: PackTemplateMeta[];
  },
): PolicyDocument[] {
  if (documents.length === 0) return documents;

  const libraryById = new Map<number, LibraryDocumentRecord>();
  const libraryByFile = new Map<string, LibraryDocumentRecord>();
  for (const doc of options.libraryDocs ?? []) {
    libraryById.set(doc.libraryDocumentId, doc);
    libraryByFile.set(doc.filename.trim().toLowerCase(), doc);
  }
  const templateByKey = new Map(
    (options.templates ?? []).map((template) => [template.key, template]),
  );

  let changed = false;
  const next = documents.map((doc) => {
    let name: string | undefined;
    if (doc.libraryDocumentId != null) {
      const library = libraryById.get(doc.libraryDocumentId);
      if (library) name = formatDocumentLabel(library.displayName);
    } else if (doc.templateKey) {
      const template = templateByKey.get(doc.templateKey);
      if (template) name = packTemplateLabel(template);
    } else if (doc.filename) {
      const library = libraryByFile.get(doc.filename.trim().toLowerCase());
      if (library) name = formatDocumentLabel(library.displayName);
    }
    if (name == null || name === doc.name) return doc;
    changed = true;
    return { ...doc, name };
  });

  return changed ? next : documents;
}

export type BuildReviewDocumentPackOptions = {
  /**
   * When false, only published document templates are generated.
   * Static document-library attachments are omitted (already on the policy).
   */
  includeLibrary?: boolean;
  /** Live broker fee schedule lines (named PDF fee merge fields). */
  brokerFeeLines?: BrokerFeeLineInput[];
};

/** True when the policy already has static / library attachments. */
export function policyHasLibraryDocuments(
  documents: PolicyDocument[] | undefined,
): boolean {
  return (documents ?? []).some(
    (doc) =>
      doc.libraryDocumentId != null ||
      (!doc.templateKey && Boolean(doc.filename)),
  );
}

/** Build the Review-stage document pack from published templates for the cover. */
export function buildReviewDocumentPack(
  policy: Policy,
  generatedBy: string,
  templates: PackTemplateMeta[],
  existing: PolicyDocument[] = [],
  libraryDocs?: LibraryDocumentRecord[],
  options?: BuildReviewDocumentPackOptions,
): PolicyDocument[] {
  const includeLibrary = options?.includeLibrary ?? true;
  const generationKey = reviewDocumentsFingerprint(policy);
  const when = new Date();
  const stamp = formatDocTimestamp(when);
  const generatedWhen = when.toISOString();

  const docs: PolicyDocument[] = templates.map((template) => {
    const amendment = nextAmendmentNumber(existing, template.key);
    const safeKey = template.key.replace(/[^a-zA-Z0-9_-]+/g, "_");
    const name = packTemplateLabel(template);
    return makeDoc({
      policyId: policy.policyId,
      name,
      filename: `${safeKey}_${policyDisplayNumber(policy)}_${amendment}_${stamp}.pdf`,
      generationKey,
      content: [
        template.title || template.key,
        `Policy number: ${policyDisplayNumber(policy)}`,
        `Insured: ${policy.car.insuredName}`,
      ].join("\n"),
      generatedBy,
      generatedWhen,
      templateKey: template.key,
    });
  });

  if (!includeLibrary) return docs;

  const libraryAttachments = resolveLibraryAttachments(policy, libraryDocs);
  for (const item of libraryAttachments) {
    docs.push(
      makeDoc({
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
        name: formatDocumentLabel(doc.displayName),
        filename: doc.filename,
        libraryDocumentId: doc.libraryDocumentId,
        content: [
          doc.displayName,
          `Attached for policy ${policyDisplayNumber(policy)}.`,
        ].join("\n"),
      }));
  }

  const items: LibraryAttachment[] = [];
  if (policy.stateId === 2) {
    items.push({
      name: "ATC Stamp Duty Exemp",
      filename: "ATC Stamp duty Exemption.pdf",
      content: [
        "ATC Stamp Duty Exemption",
        `Policy number: ${policyDisplayNumber(policy)}`,
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
        `Attached for policy ${policyDisplayNumber(policy)}.`,
      ].join("\n"),
    },
    {
      name: "IA Annual CAR TPL Wor",
      filename: "IA Annual CAR TPL Wording (eff Jan 2026) - Sample.pdf",
      content: [
        "IA Annual CAR TPL Wording (effective January 2026)",
        `Wording attached for policy ${policyDisplayNumber(policy)}.`,
      ].join("\n"),
    },
  );
  return items;
}

/**
 * Pack generated when an adjustment is saved: adjustment template only.
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

  return templates.map((template) => {
    const amendment = nextAmendmentNumber(existing, template.key);
    const safeKey = template.key.replace(/[^a-zA-Z0-9_-]+/g, "_");
    const name = packTemplateLabel(template);
    return makeDoc({
      policyId: policy.policyId,
      name,
      filename: `${safeKey}_${policyDisplayNumber(policy)}_${amendment}_${stamp}.pdf`,
      generationKey,
      content: [
        template.title || template.key,
        `Policy number: ${policyDisplayNumber(policy)}`,
        `Insured: ${policy.car.insuredName}`,
      ].join("\n"),
      generatedBy,
      generatedWhen,
      templateKey: template.key,
    });
  });
}
