import type { Policy, PolicyDocument } from "~/lib/db/types";
import { isStaticSchemaName } from "~/lib/documents/template-editor-form";
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import { getPdfmeFonts } from "~/lib/pdf/fonts";
import { buildLegacyTextPdfBlob } from "~/lib/pdf/legacy-text-pdf";
import {
  normalizePdfmeTemplateSchemas,
  policyToMergeInputs,
  resolveMultiVariableTextInput,
  resolveTableContentPlaceholders,
} from "~/lib/pdf/merge-fields";
import { pdfmePlugins } from "~/lib/pdf/plugins";
import type { DocumentTemplate } from "~/lib/pdf/templates";
import {
  getCachedPublishedTemplate,
  invalidatePdfTemplateOverrideCache,
  setCachedPublishedTemplate,
  type CachedPublishedTemplate,
} from "~/lib/pdf/template-override-cache";

export { invalidatePdfTemplateOverrideCache };

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
): Promise<DocumentTemplate | null> {
  const cached = getCachedPublishedTemplate(templateKey);
  if (cached) {
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
      setCachedPublishedTemplate(templateKey, null);
      return null;
    }
    if (!res.ok) {
      setCachedPublishedTemplate(templateKey, null);
      return null;
    }
    const data = (await res.json()) as CachedPublishedTemplate;
    setCachedPublishedTemplate(templateKey, data);
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

async function resolveTemplateForGeneration(
  templateKey: string,
  templateOverride?: DocumentTemplate,
): Promise<DocumentTemplate | null> {
  if (templateOverride) return templateOverride;

  if (typeof window === "undefined") {
    // Server callers must pass templateOverride (or use resolvePublishedPdfTemplate).
    return null;
  }

  return fetchPublishedTemplate(templateKey);
}

export async function generatePolicyPdf(
  templateKey: string,
  policy: Policy,
  mergeInputs?: Record<string, string>,
  templateOverride?: DocumentTemplate,
): Promise<{
  pdf: Uint8Array;
  templateKey: string;
  inputs: Record<string, string>;
}> {
  const resolved = await resolveTemplateForGeneration(
    templateKey,
    templateOverride,
  );
  if (!resolved) {
    throw new Error(`No published pdfme template for ${templateKey}`);
  }

  const baseInputs = mergeInputs ?? policyToMergeInputs(policy);
  const inputs: Record<string, string> = {
    ...Object.fromEntries(resolved.mergeFields.map((name) => [name, ""])),
    ...baseInputs,
  };

  const normalizedTemplate = normalizePdfmeTemplateSchemas(
    resolved.template as unknown as {
      schemas: Array<Array<Record<string, unknown>>>;
    },
  ) as typeof resolved.template;

  for (const page of normalizedTemplate.schemas) {
    for (const schema of page) {
      const name = schema.name;
      if (!name) continue;
      if (isStaticSchemaName(name) && typeof schema.content === "string") {
        inputs[name] = schema.content;
        continue;
      }
      // Table / list inputs must be JSON arrays. Resolve `{MergeField}`
      // placeholders in the schema body from individual merge inputs.
      if (schema.type === "table" && typeof schema.content === "string") {
        inputs[name] = resolveTableContentPlaceholders(schema.content, inputs);
        continue;
      }
      if (schema.type === "multiVariableText") {
        const mvt = resolveMultiVariableTextInput(
          schema as Record<string, unknown>,
          inputs,
        );
        if (mvt != null) inputs[name] = mvt;
        continue;
      }
      if (schema.type === "list" && typeof schema.content === "string") {
        const current = inputs[name];
        if (!current) {
          inputs[name] = schema.content;
          continue;
        }
        try {
          if (!Array.isArray(JSON.parse(current))) {
            inputs[name] = schema.content;
          }
        } catch {
          inputs[name] = schema.content;
        }
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

  const template = applyFlowPushDown(
    normalizedTemplate,
    resolved.flowPushDown,
    inputs,
  );

  // Dynamic import keeps @pdfme/generator out of the default Worker SSR graph.
  const [{ generate }, font] = await Promise.all([
    import("@pdfme/generator"),
    getPdfmeFonts(),
  ]);
  const pdf = await generate({
    template,
    inputs: [inputs],
    plugins: pdfmePlugins,
    options: { font },
  });

  return { pdf, templateKey: resolved.key, inputs };
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
