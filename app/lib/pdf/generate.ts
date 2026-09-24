import type { Font } from "@pdfme/common";

import type { CarWording, Policy, PolicyDocument } from "~/lib/db/types";
import { isStaticSchemaName } from "~/lib/documents/template-editor-form";
import { expandEndorsementPairSchemas } from "~/lib/pdf/endorsement-expand";
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import type { EndorsementRichDrawOp } from "~/lib/pdf/html-rich-text-draw";
import { applyEndorsementRichDrawOps } from "~/lib/pdf/html-rich-text-draw";
import { buildLegacyTextPdfBlob } from "~/lib/pdf/legacy-text-pdf";
import {
  type BrokerFeeLineInput,
  normalizePdfmeTemplateSchemas,
  policyToMergeInputs,
  resolveMultiVariableTextInput,
  syncTableSchemasToInputs,
} from "~/lib/pdf/merge-fields";
import { pdfmePlugins } from "~/lib/pdf/pdf-plugins";
import {
  type CachedPublishedTemplate,
  getCachedPublishedTemplate,
  invalidatePdfTemplateOverrideCache,
  setCachedPublishedTemplate,
} from "~/lib/pdf/template-override-cache";
import type { DocumentTemplate } from "~/lib/pdf/templates";
import {
  looksLikeHtml,
  plainTextFromWordingHtml,
} from "~/lib/policies/wording/html";

export { invalidatePdfTemplateOverrideCache };

export function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
      label: cached.value.label ?? "",
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
      label: data.label ?? "",
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
  options?: {
    wordingCatalogue?: CarWording[];
    brokerFeeLines?: BrokerFeeLineInput[];
    font?: Font;
  },
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

  // Derive from the policy snapshot passed in (wizard should pass form+premium
  // overrides). Optional mergeInputs only fill gaps — never overwrite live keys.
  const liveInputs = policyToMergeInputs(policy, {
    wordingCatalogue: options?.wordingCatalogue,
    brokerFeeLines: options?.brokerFeeLines,
  });
  const baseInputs = {
    ...(mergeInputs ?? {}),
    ...liveInputs,
  };
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
      // Table inputs resolved below via syncTableSchemasToInputs (content + height).
      if (schema.type === "table") continue;
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
      // Designer renames (e.g. "Transit copy") keep content `{Transit}` — fill
      // from the canonical merge key when this schema name has no value.
      if (typeof schema.content === "string" && !inputs[name]) {
        const single = /^\{([A-Za-z0-9_]+)\}$/.exec(schema.content.trim());
        if (single) {
          const fromKey = single[1]!;
          const from = baseInputs[fromKey] ?? inputs[fromKey];
          if (from) {
            inputs[name] = from;
            continue;
          }
        }
      }
      if (name in inputs && inputs[name]) continue;
      const m = /^(.+)__(\d+)$/.exec(name);
      if (m && m[1] in baseInputs) {
        inputs[name] = baseInputs[m[1]] ?? "";
      } else if (m && m[1] in inputs) {
        inputs[name] = inputs[m[1]] ?? "";
      }
    }
  }

  // Grow table schemas (e.g. legacy Endorsements table) to fit resolved rows.
  const withTables = syncTableSchemasToInputs(normalizedTemplate, inputs);

  // Subject+Content prototypes → one styled pair per wording (hide if empty).
  // Rich HTML is drawn with pdf-lib after pdfme (drawOps).
  const drawOps: EndorsementRichDrawOp[] = [];
  const withEndorsements = expandEndorsementPairSchemas(
    withTables,
    inputs,
    drawOps,
  );

  // Legacy Endorsements table / scalar fields: pdfme cannot render HTML tags.
  for (const [key, value] of Object.entries(inputs)) {
    if (!value || !looksLikeHtml(value)) continue;
    if (
      key === "Endorsements" ||
      key.startsWith("EndorsementSubject") ||
      key.startsWith("EndorsementContent")
    ) {
      if (key === "Endorsements") {
        try {
          const rows = JSON.parse(value) as unknown;
          if (Array.isArray(rows)) {
            inputs[key] = JSON.stringify(
              rows.map((row) =>
                Array.isArray(row)
                  ? row.map((cell) =>
                      looksLikeHtml(String(cell ?? ""))
                        ? plainTextFromWordingHtml(String(cell ?? ""))
                        : String(cell ?? ""),
                    )
                  : row,
              ),
            );
          }
        } catch {
          inputs[key] = plainTextFromWordingHtml(value);
        }
      } else if (drawOps.length === 0) {
        inputs[key] = plainTextFromWordingHtml(value);
      }
    }
  }

  const template = applyFlowPushDown(
    withEndorsements,
    resolved.flowPushDown,
    inputs,
  );

  // Dynamic import keeps @pdfme/generator out of the default Worker SSR graph.
  if (!options?.font) {
    throw new Error("PDF font data is required for document generation.");
  }
  const { generate } = await import("@pdfme/generator");
  const font = options.font;
  let pdf = await generate({
    template,
    inputs: [inputs],
    plugins: pdfmePlugins,
    options: { font },
  });

  if (drawOps.length > 0) {
    try {
      const overlay = await applyEndorsementRichDrawOps(pdf, drawOps, font);
      pdf = new Uint8Array(overlay) as typeof pdf;
    } catch {
      // Keep the pdfme base PDF (plain-text endorsements still render).
    }
  }

  return { pdf, templateKey: resolved.key, inputs };
}

export async function buildPdfBlobFromPolicy(
  templateKey: string,
  policy: Policy,
  options?: {
    wordingCatalogue?: CarWording[];
    brokerFeeLines?: BrokerFeeLineInput[];
    mergeInputs?: Record<string, string>;
    font?: Font;
  },
): Promise<Blob> {
  const { pdf } = await generatePolicyPdf(
    templateKey,
    policy,
    options?.mergeInputs,
    undefined,
    {
      wordingCatalogue: options?.wordingCatalogue,
      brokerFeeLines: options?.brokerFeeLines,
      font: options?.font,
    },
  );
  return new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
}

function isLibraryDocument(doc: PolicyDocument) {
  return doc.libraryDocumentId != null || !doc.templateKey;
}

export async function buildPdfBlobFromDocument(
  doc: PolicyDocument,
  policy?: Policy,
  options?: {
    wordingCatalogue?: CarWording[];
    brokerFeeLines?: BrokerFeeLineInput[];
    font?: Font;
  },
): Promise<Blob> {
  if (doc.r2Key && policy?.policyId) {
    try {
      const apiRes = await fetch(
        `/api/policies/${policy.policyId}/documents/r2?key=${encodeURIComponent(doc.r2Key)}`,
      );
      if (apiRes.ok) {
        const contentType = apiRes.headers.get("content-type") ?? "";
        if (
          contentType.includes("application/pdf") ||
          contentType.includes("octet-stream")
        ) {
          return apiRes.blob();
        }
      }
    } catch {
      // Fall through to other sources.
    }
  }

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

  const templateKey = doc.templateKey;
  if (!templateKey) {
    return buildLegacyTextPdfBlob(doc.name, doc.content);
  }

  // Rebuild from the policy snapshot so Limits / Premium Breakdown overrides
  // stay current.
  if (policy) {
    return buildPdfBlobFromPolicy(templateKey, policy, {
      wordingCatalogue: options?.wordingCatalogue,
      brokerFeeLines: options?.brokerFeeLines,
      font: options?.font,
    });
  }

  return buildLegacyTextPdfBlob(doc.name, doc.content);
}
