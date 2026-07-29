import type { Template } from "@pdfme/common";

export type TemplatePayload = {
  basePdf: string | Record<string, unknown>;
  schemas: Record<string, unknown>[][];
};

export type FlowPushDownPayload = {
  pageIndex: number;
  anchor: string;
  anchorOriginalHeightMm: number;
  followFields: string[];
  staticInputs: Record<string, string>;
};

export function parseTemplateForm(formData: FormData):
  | {
      ok: true;
      template: TemplatePayload;
      flowPushDown: FlowPushDownPayload | null | undefined;
      mergeFields: string[] | undefined;
    }
  | { ok: false; error: string } {
  const templateRaw = String(formData.get("template") ?? "");
  let templateJson: unknown;
  try {
    templateJson = JSON.parse(templateRaw);
  } catch {
    return { ok: false, error: "Invalid template JSON." };
  }

  const flowRaw = String(formData.get("flowPushDown") ?? "");
  let flowPushDown: unknown = undefined;
  if (flowRaw) {
    try {
      flowPushDown = JSON.parse(flowRaw);
    } catch {
      return { ok: false, error: "Invalid flowPushDown JSON." };
    }
  }

  const mergeRaw = String(formData.get("mergeFields") ?? "");
  let mergeFields: string[] | undefined;
  if (mergeRaw) {
    try {
      mergeFields = JSON.parse(mergeRaw) as string[];
    } catch {
      return { ok: false, error: "Invalid mergeFields JSON." };
    }
  }

  return {
    ok: true,
    template: templateJson as TemplatePayload,
    flowPushDown: flowPushDown as FlowPushDownPayload | null | undefined,
    mergeFields,
  };
}

export function collectMergeFields(
  template: Template,
  fallback: string[],
): string[] {
  const names = new Set<string>(
    fallback.filter(
      (name) => !name.startsWith("_Label_") && !name.startsWith("_Static_"),
    ),
  );
  for (const page of template.schemas) {
    for (const schema of page) {
      const name = schema.name;
      if (!name || name.startsWith("_Label_") || name.startsWith("_Static_")) {
        continue;
      }
      if (schema.type === "text") {
        names.add(name);
      }
      if (
        schema.type === "multiVariableText" &&
        typeof schema.content === "string"
      ) {
        for (const match of schema.content.matchAll(/\{([^{}]+)\}/g)) {
          names.add(match[1]!.trim());
        }
      }
    }
  }
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function documentTemplateStatusLabel(input: {
  publishedVersionNumber: number | null;
  editingVersionNumber: number | null;
  editingIsPublished: boolean;
}): string {
  if (input.publishedVersionNumber != null) {
    const draftNote =
      input.editingVersionNumber != null &&
      input.editingVersionNumber !== input.publishedVersionNumber
        ? ` · editing draft v${input.editingVersionNumber}`
        : input.editingIsPublished
          ? " · editing published"
          : "";
    return `Published v${input.publishedVersionNumber}${draftNote}`;
  }
  if (input.editingVersionNumber != null) {
    return `Draft v${input.editingVersionNumber} (not published — seed is live)`;
  }
  return "Seed template (nothing published)";
}
