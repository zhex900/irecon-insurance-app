import { generate } from "@pdfme/generator";
import type {
  Policy,
  PolicyDocument,
  PolicyDocumentTypeCode,
} from "~/lib/db/types";
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import { buildLegacyTextPdfBlob } from "~/lib/pdf/legacy-text-pdf";
import { policyToMergeInputs } from "~/lib/pdf/merge-fields";
import { pdfmePlugins } from "~/lib/pdf/plugins";
import {
  LIBRARY_DOCUMENT_PATHS,
  resolvePdfTemplate,
  type PdfTemplateSlot,
} from "~/lib/pdf/templates";

const plugins = pdfmePlugins;

type SlotOverridePayload = {
  template: PdfTemplateSlot["template"];
  flowPushDown: PdfTemplateSlot["flowPushDown"];
  mergeFields: string[];
  versionNumber: number;
};

const clientOverrideCache = new Map<
  string,
  { at: number; value: SlotOverridePayload | null }
>();
const CLIENT_OVERRIDE_TTL_MS = 60_000;

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

function mergeSlot(
  base: PdfTemplateSlot,
  override: SlotOverridePayload,
): PdfTemplateSlot {
  return {
    ...base,
    template: override.template,
    flowPushDown: override.flowPushDown ?? base.flowPushDown ?? null,
    mergeFields:
      override.mergeFields.length > 0 ? override.mergeFields : base.mergeFields,
    versionNumber: override.versionNumber,
  };
}

async function fetchClientSlotOverride(
  slotKey: string,
): Promise<SlotOverridePayload | null> {
  const cached = clientOverrideCache.get(slotKey);
  if (cached && Date.now() - cached.at < CLIENT_OVERRIDE_TTL_MS) {
    return cached.value;
  }

  try {
    const res = await fetch(
      `/api/document-templates/${encodeURIComponent(slotKey)}`,
    );
    if (res.status === 204) {
      clientOverrideCache.set(slotKey, { at: Date.now(), value: null });
      return null;
    }
    if (!res.ok) {
      clientOverrideCache.set(slotKey, { at: Date.now(), value: null });
      return null;
    }
    const data = (await res.json()) as SlotOverridePayload;
    clientOverrideCache.set(slotKey, { at: Date.now(), value: data });
    return data;
  } catch {
    return null;
  }
}

/** Drop cached DB overrides after Settings saves so generation picks up edits. */
export function invalidatePdfTemplateOverrideCache(slotKey?: string) {
  if (slotKey) {
    clientOverrideCache.delete(slotKey);
    return;
  }
  clientOverrideCache.clear();
}

async function resolveSlotForGeneration(
  documentTypeCode: PolicyDocumentTypeCode,
  coverTypeId: number,
  slotOverride?: PdfTemplateSlot,
): Promise<PdfTemplateSlot | null> {
  if (slotOverride) return slotOverride;

  const base = resolvePdfTemplate(documentTypeCode, coverTypeId);
  if (!base) return null;

  if (typeof window === "undefined") {
    return base;
  }

  const override = await fetchClientSlotOverride(base.key);
  return override ? mergeSlot(base, override) : base;
}

export async function generatePolicyPdf(
  documentTypeCode: PolicyDocumentTypeCode,
  policy: Policy,
  mergeInputs?: Record<string, string>,
  slotOverride?: PdfTemplateSlot,
): Promise<{
  pdf: Uint8Array;
  templateKey: string;
  inputs: Record<string, string>;
}> {
  const slot = await resolveSlotForGeneration(
    documentTypeCode,
    policy.car.coverTypeId,
    slotOverride,
  );
  if (!slot) {
    throw new Error(`No pdfme template for ${documentTypeCode}`);
  }

  const baseInputs = mergeInputs ?? policyToMergeInputs(policy);
  const inputs: Record<string, string> = {
    ...Object.fromEntries(slot.mergeFields.map((name) => [name, ""])),
    ...baseInputs,
  };

  // Duplicate placeholders on the Word layout use Name__2, Name__3, …
  // Static labels (_Label_*, _Static_*) keep schema.content via inputs.
  for (const page of slot.template.schemas) {
    for (const schema of page) {
      const name = schema.name;
      if (!name) continue;
      if (
        (name.startsWith("_Label_") || name.startsWith("_Static_")) &&
        typeof schema.content === "string" &&
        !(name in inputs)
      ) {
        inputs[name] = schema.content;
        continue;
      }
      if (name in inputs) continue;
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
