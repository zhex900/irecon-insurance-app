import { generate } from "@pdfme/generator";
import { text } from "@pdfme/schemas";
import type {
  Policy,
  PolicyDocument,
  PolicyDocumentTypeCode,
} from "~/lib/db/types";
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import { buildLegacyTextPdfBlob } from "~/lib/pdf/legacy-text-pdf";
import { policyToMergeInputs } from "~/lib/pdf/merge-fields";
import {
  LIBRARY_DOCUMENT_PATHS,
  resolvePdfTemplate,
} from "~/lib/pdf/templates";

const plugins = { text };

export function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function generatePolicyPdf(
  documentTypeCode: PolicyDocumentTypeCode,
  policy: Policy,
  mergeInputs?: Record<string, string>,
): Promise<{
  pdf: Uint8Array;
  templateKey: string;
  inputs: Record<string, string>;
}> {
  const slot = resolvePdfTemplate(documentTypeCode, policy.car.coverTypeId);
  if (!slot) {
    throw new Error(`No pdfme template for ${documentTypeCode}`);
  }

  const baseInputs = mergeInputs ?? policyToMergeInputs(policy);
  const inputs: Record<string, string> = {
    ...Object.fromEntries(slot.mergeFields.map((name) => [name, ""])),
    ...baseInputs,
  };

  // Duplicate placeholders on the Word layout use Name__2, Name__3, …
  for (const page of slot.template.schemas) {
    for (const schema of page) {
      const name = schema.name;
      if (!name || name in inputs) continue;
      const m = /^(.+)__(\d+)$/.exec(name);
      if (m && m[1] in baseInputs) {
        inputs[name] = baseInputs[m[1]] ?? "";
      } else if (m && m[1] in inputs) {
        inputs[name] = inputs[m[1]] ?? "";
      }
    }
  }

  const template = applyFlowPushDown(slot.template, slot.flowPushDown, inputs);

  const pdf = await generate({
    template,
    inputs: [inputs],
    plugins,
  });

  return { pdf, templateKey: slot.key, inputs };
}

export async function buildPdfBlobFromPolicy(
  documentTypeCode: PolicyDocumentTypeCode,
  policy: Policy,
): Promise<Blob> {
  const { pdf } = await generatePolicyPdf(documentTypeCode, policy);
  // Uint8Array is a valid BlobPart; cast for older DOM lib typings.
  return new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function buildPdfBlobFromDocument(
  doc: PolicyDocument,
  policy?: Policy,
): Promise<Blob> {
  if (doc.documentTypeCode === "CARADDIT") {
    const apiPath = `/api/library-documents/file/${encodeURIComponent(doc.filename)}`;
    try {
      const apiRes = await fetch(apiPath);
      if (apiRes.ok) return apiRes.blob();
    } catch {
      // Fall through to public path / text stub.
    }
    const path = LIBRARY_DOCUMENT_PATHS[doc.filename];
    if (path) {
      const res = await fetch(path);
      if (res.ok) return res.blob();
    }
    return buildLegacyTextPdfBlob(doc.name, doc.content);
  }

  if (doc.pdfBase64) {
    return new Blob([base64ToUint8(doc.pdfBase64)], {
      type: "application/pdf",
    });
  }

  if (doc.mergeInputs && policy) {
    const { pdf } = await generatePolicyPdf(
      doc.documentTypeCode,
      policy,
      doc.mergeInputs,
    );
    return new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
  }

  if (policy) {
    return buildPdfBlobFromPolicy(doc.documentTypeCode, policy);
  }

  return buildLegacyTextPdfBlob(doc.name, doc.content);
}
