import type { DocumentTemplate } from "~/lib/pdf/templates";

type CachedPublishedTemplate = {
  template: DocumentTemplate["template"];
  flowPushDown: DocumentTemplate["flowPushDown"];
  mergeFields: string[];
  versionNumber: number;
  coverTypeId?: number | null;
  title?: string;
  label?: string;
};

const clientTemplateCache = new Map<
  string,
  { at: number; value: CachedPublishedTemplate | null }
>();

const CLIENT_TEMPLATE_TTL_MS = 60_000;

export type { CachedPublishedTemplate };

export function getCachedPublishedTemplate(templateKey: string) {
  const cached = clientTemplateCache.get(templateKey);
  if (!cached || Date.now() - cached.at >= CLIENT_TEMPLATE_TTL_MS) {
    return undefined;
  }
  return cached;
}

export function setCachedPublishedTemplate(
  templateKey: string,
  value: CachedPublishedTemplate | null,
) {
  clientTemplateCache.set(templateKey, { at: Date.now(), value });
}

/** Drop cached published templates after Settings saves. */
export function invalidatePdfTemplateOverrideCache(templateKey?: string) {
  if (templateKey) {
    clientTemplateCache.delete(templateKey);
    return;
  }
  clientTemplateCache.clear();
}
