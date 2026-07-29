import { generate } from "@pdfme/generator";
import type { Policy, PolicyDocument } from "~/lib/db/types";
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import { buildLegacyTextPdfBlob } from "~/lib/pdf/legacy-text-pdf";
import { policyToMergeInputs } from "~/lib/pdf/merge-fields";
import { pdfmePlugins } from "~/lib/pdf/plugins";
import type { DocumentTemplateSlot } from "~/lib/pdf/templates";

const plugins = pdfmePlugins;

type SlotPayload = {
  template: DocumentTemplateSlot["template"];
  flowPushDown: DocumentTemplateSlot["flowPushDown"];
  mergeFields: string[];
  versionNumber: number;
  coverTypeId?: number | null;
  title?: string;
};

const clientTemplateCache = new Map<
  string,
  { at: number; value: SlotPayload | null }
>();
const CLIENT_TEMPLATE_TTL_MS = 60_000;

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

async function fetchPublishedTemplate(
  templateKey: string,
): Promise<DocumentTemplateSlot | null> {
  const cached = clientTemplateCache.get(templateKey);
  if (cached && Date.now() - cached.at < CLIENT_TEMPLATE_TTL_MS) {
    if (!cached.value) return null;
    return {
      key: templateKey,
      coverTypeId: cached.value.coverTypeId ?? null,
      title: cached.value.title ?? templateKey,
      versionNumber: cached.value.versionNumber,
      mergeFields: cached.value.mergeFields,
      flowPushDown: cached.value.flowPushDown ?? null,
      template: cached.value.template,
    };
  }

  try {
    const res = await fetch(
      `/api/document-templates/${encodeURIComponent(templateKey)}`,
    );
    if (res.status === 404 || res.status === 204) {
      clientTemplateCache.set(templateKey, { at: Date.now(), value: null });
      return null;
    }
    if (!res.ok) {
      clientTemplateCache.set(templateKey, { at: Date.now(), value: null });
      return null;
    }
    const data = (await res.json()) as SlotPayload;
    clientTemplateCache.set(templateKey, { at: Date.now(), value: data });
    return {
      key: templateKey,
      coverTypeId: data.coverTypeId ?? null,
      title: data.title ?? templateKey,
      versionNumber: data.versionNumber,
      mergeFields: data.mergeFields,
      flowPushDown: data.flowPushDown ?? null,
      template: data.template,
    };
  } catch {
    return null;
  }
}

/** Drop cached published templates after Settings saves. */
export function invalidatePdfTemplateOverrideCache(slotKey?: string) {
  if (slotKey) {
    clientTemplateCache.delete(slotKey);
    return;
  }
  clientTemplateCache.clear();
}

async function resolveSlotForGeneration(
  templateKey: string,
  slotOverride?: DocumentTemplateSlot,
): Promise<DocumentTemplateSlot | null> {
  if (slotOverride) return slotOverride;

  if (typeof window === "undefined") {
    // Server callers must pass slotOverride (or use resolvePublishedPdfTemplate).
    return null;
  }

  return fetchPublishedTemplate(templateKey);
}

export async function generatePolicyPdf(
  templateKey: string,
  policy: Policy,
  mergeInputs?: Record<string, string>,
  slotOverride?: DocumentTemplateSlot,
): Promise<{
  pdf: Uint8Array;
  templateKey: string;
  inputs: Record<string, string>;
}> {
  const slot = await resolveSlotForGeneration(templateKey, slotOverride);
  if (!slot) {
    throw new Error(`No published pdfme template for ${templateKey}`);
  }

  const baseInputs = mergeInputs ?? policyToMergeInputs(policy);
  const inputs: Record<string, string> = {
    ...Object.fromEntries(slot.mergeFields.map((name) => [name, ""])),
    ...baseInputs,
  };

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
  templateKey: string,
  policy: Policy,
): Promise<Blob> {
  const { pdf } = await generatePolicyPdf(templateKey, policy);
  return new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
}

function isLibraryDocument(doc: PolicyDocument) {
  return doc.libraryDocumentId != null || !doc.templateKey;
}

export async function buildPdfBlobFromDocument(
  doc: PolicyDocument,
  policy?: Policy,
): Promise<Blob> {
  if (isLibraryDocument(doc) && !doc.templateKey) {
    const apiPath =
      doc.libraryDocumentId != null
        ? `/api/library-documents/${doc.libraryDocumentId}`
        : `/api/library-documents/file/${encodeURIComponent(doc.filename)}`;
    try {
      const apiRes = await fetch(apiPath);
      if (apiRes.ok) {
        const contentType = apiRes.headers.get("content-type") ?? "";
        if (
          contentType.includes("application/pdf") ||
          contentType.includes("octet-stream")
        ) {
          return apiRes.blob();
        }
        // JSON metadata responses are not PDFs — fall through to filename API.
        if (doc.libraryDocumentId != null) {
          const fileRes = await fetch(
            `/api/library-documents/file/${encodeURIComponent(doc.filename)}`,
          );
          if (fileRes.ok) return fileRes.blob();
        }
      }
    } catch {
      // Fall through to text stub when R2/API is unavailable.
    }
    return buildLegacyTextPdfBlob(doc.name, doc.content);
  }

  if (doc.pdfBase64) {
    return new Blob([base64ToUint8(doc.pdfBase64)], {
      type: "application/pdf",
    });
  }

  const templateKey = doc.templateKey;
  if (!templateKey) {
    return buildLegacyTextPdfBlob(doc.name, doc.content);
  }

  if (doc.mergeInputs && policy) {
    const { pdf } = await generatePolicyPdf(
      templateKey,
      policy,
      doc.mergeInputs,
    );
    return new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
  }

  if (policy) {
    return buildPdfBlobFromPolicy(templateKey, policy);
  }

  return buildLegacyTextPdfBlob(doc.name, doc.content);
}
