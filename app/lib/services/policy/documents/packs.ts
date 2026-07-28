import type { Policy, PolicyDocument } from "~/lib/db/types";
import {
  libraryDocumentMatchesPolicy,
  type LibraryDocumentRecord,
} from "~/lib/library-documents";
import {
  buildAdjustmentContent,
  buildRatingContent,
  buildScheduleContent,
  formatDocTimestamp,
  makeDoc,
  nextAmendmentNumber,
  templateMeta,
} from "~/lib/services/policy/documents/content";
import {
  adjustmentDocumentsFingerprint,
  reviewDocumentsFingerprint,
} from "~/lib/services/policy/documents/fingerprints";

/** Build the Review-stage document pack from the current policy snapshot. */
export function buildReviewDocumentPack(
  policy: Policy,
  generatedBy: string,
  existing: PolicyDocument[] = [],
  libraryDocs?: LibraryDocumentRecord[],
): PolicyDocument[] {
  const generationKey = reviewDocumentsFingerprint(policy);
  const when = new Date();
  const stamp = formatDocTimestamp(when);
  const generatedWhen = when.toISOString();
  let nextId = 1;

  const scheduleAmendment = nextAmendmentNumber(existing, "CARSCHED");
  const scheduleMeta = templateMeta(policy, "CARSCHED");
  const docs: PolicyDocument[] = [
    makeDoc({
      id: nextId++,
      policyId: policy.policyId,
      code: "CARSCHED",
      name: "CAR Schedule",
      filename: `CAR_Schedule_${policy.policyNumber}_${scheduleAmendment}_${stamp}.pdf`,
      generationKey,
      content: buildScheduleContent(policy),
      generatedBy,
      generatedWhen,
      ...scheduleMeta,
    }),
  ];

  if (policy.car.premium) {
    const ratingAmendment = nextAmendmentNumber(existing, "CARRATING");
    const ratingMeta = templateMeta(policy, "CARRATING");
    docs.push(
      makeDoc({
        id: nextId++,
        policyId: policy.policyId,
        code: "CARRATING",
        name: "CAR Rating / ROA",
        filename: `Car_Premium&ROA_${policy.policyNumber}_${ratingAmendment}_${stamp}.pdf`,
        generationKey,
        content: buildRatingContent(policy),
        generatedBy,
        generatedWhen,
        ...ratingMeta,
      }),
    );
  }

  // Library attachments (CARADDIT) — fixed filenames; only added once.
  const libraryAttachments = resolveLibraryAttachments(policy, libraryDocs);
  for (const item of libraryAttachments) {
    docs.push(
      makeDoc({
        id: nextId++,
        policyId: policy.policyId,
        code: "CARADDIT",
        name: item.name,
        filename: item.filename,
        generationKey,
        content: item.content,
        generatedBy,
        generatedWhen,
      }),
    );
  }

  return docs;
}

type LibraryAttachment = {
  name: string;
  filename: string;
  content: string;
};

/** Prefer DB library docs; fall back to hardcoded seed filenames. */
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
        `Sample wording attached for policy ${policy.policyNumber}.`,
      ].join("\n"),
    },
  );
  return items;
}

/**
 * Pack generated when an adjustment is saved:
 * Adjustment PDF + updated Schedule + Rating reflecting effective premium.
 * Previous documents are kept (append-only via mergeReviewDocuments).
 */
export function buildAdjustmentDocumentPack(
  policy: Policy,
  generatedBy: string,
  existing: PolicyDocument[] = [],
): PolicyDocument[] {
  if (!policy.car.adjustment || !policy.car.premium) return [];

  const generationKey = adjustmentDocumentsFingerprint(policy);
  const when = new Date();
  const stamp = formatDocTimestamp(when);
  const generatedWhen = when.toISOString();
  let nextId = 1;

  const adjustAmendment = nextAmendmentNumber(existing, "CARADJUST");
  const scheduleAmendment = nextAmendmentNumber(existing, "CARSCHED");
  const ratingAmendment = nextAmendmentNumber(existing, "CARRATING");
  const adjustMeta = templateMeta(policy, "CARADJUST");
  const scheduleMeta = templateMeta(policy, "CARSCHED");
  const ratingMeta = templateMeta(policy, "CARRATING");

  return [
    makeDoc({
      id: nextId++,
      policyId: policy.policyId,
      code: "CARADJUST",
      name: "CAR Adjustment",
      filename: `CAR_Adjustment_${policy.policyNumber}_${adjustAmendment}_${stamp}.pdf`,
      generationKey,
      content: buildAdjustmentContent(policy),
      generatedBy,
      generatedWhen,
      ...adjustMeta,
    }),
    makeDoc({
      id: nextId,
      policyId: policy.policyId,
      code: "CARSCHED",
      name: "CAR Schedule",
      filename: `CAR_Schedule_${policy.policyNumber}_${scheduleAmendment}_${stamp}.pdf`,
      generationKey,
      content: buildScheduleContent(policy),
      generatedBy,
      generatedWhen,
      ...scheduleMeta,
    }),
    makeDoc({
      id: nextId + 1,
      policyId: policy.policyId,
      code: "CARRATING",
      name: "CAR Rating / ROA",
      filename: `Car_Premium&ROA_${policy.policyNumber}_${ratingAmendment}_${stamp}.pdf`,
      generationKey,
      content: buildRatingContent(policy),
      generatedBy,
      generatedWhen,
      ...ratingMeta,
    }),
  ];
}
