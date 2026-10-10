/**
 * Resolve POLICY_DOCUMENT_PATH(S) to absolute directories on disk.
 *
 * POLICY_DOCUMENT_PATHS — comma-separated list (preferred)
 * POLICY_DOCUMENT_PATH — single folder (legacy)
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

import {
  buildLocalMergeDocumentIndex,
  mergeDocumentLocalMatchKey,
} from "./legacy-merge-document-filename.mts";

function normalizePolicyDocumentPath(configured: string): string {
  let path = configured.trim();
  if (!path) return "";

  if (
    (path.startsWith('"') && path.endsWith('"')) ||
    (path.startsWith("'") && path.endsWith("'"))
  ) {
    path = path.slice(1, -1).trim();
  }

  if (path.startsWith("~/")) {
    path = join(homedir(), path.slice(2));
  } else if (path.startsWith("/Desktop/") || path.startsWith("/Documents/")) {
    path = join(homedir(), path.slice(1));
  } else if (!isAbsolute(path)) {
    path = join(process.cwd(), path);
  }

  return path;
}

export function parsePolicyDocumentPathConfig(raw?: string): string[] {
  const configured =
    raw ??
    process.env.POLICY_DOCUMENT_PATHS ??
    process.env.POLICY_DOCUMENT_PATH ??
    "";
  const trimmed = configured.trim();
  if (!trimmed) return [];

  return trimmed
    .split(",")
    .map((part) => normalizePolicyDocumentPath(part))
    .filter(Boolean);
}

export function resolvePolicyDocumentRoots(raw?: string): string[] {
  const roots = parsePolicyDocumentPathConfig(raw);
  if (roots.length === 0) {
    throw new Error(
      "POLICY_DOCUMENT_PATHS (or POLICY_DOCUMENT_PATH) is not set. Point it at the legacy PDF export folder(s).",
    );
  }

  const missing = roots.filter((root) => !existsSync(root));
  if (missing.length > 0) {
    throw new Error(
      `Policy document director${missing.length === 1 ? "y" : "ies"} not found: ${missing.join(", ")}`,
    );
  }

  return roots;
}

/** First configured root (legacy callers). */
export function resolvePolicyDocumentRoot(raw?: string): string {
  return resolvePolicyDocumentRoots(raw)[0]!;
}

export function expectedLegacyDocumentPath(
  root: string,
  filename: string,
): string {
  const safe = filename.replace(/[/\\]/g, "_").trim();
  return join(root, safe);
}

export function expectedLegacyDocumentPaths(
  roots: string[],
  filename: string,
): string {
  return roots
    .map((root) => expectedLegacyDocumentPath(root, filename))
    .join(";");
}

export type LegacyDocumentLookupContext = {
  roots: string[];
  mergeIndex: Map<string, string>;
};

export function createLegacyDocumentLookupContext(
  roots: string[],
): LegacyDocumentLookupContext {
  return {
    roots,
    mergeIndex: buildLocalMergeDocumentIndex(roots),
  };
}

export function resolveLegacyDocumentFile(
  roots: string | string[],
  filename: string,
  documentTypeCode?: string,
  lookup?: LegacyDocumentLookupContext,
): string | null {
  const safe = filename.replace(/[/\\]/g, "_").trim();
  if (!safe) return null;

  const rootList = Array.isArray(roots) ? roots : [roots];
  for (const root of rootList) {
    const full = expectedLegacyDocumentPath(root, filename);
    if (existsSync(full)) return full;
  }

  if (documentTypeCode && lookup) {
    const key = mergeDocumentLocalMatchKey(documentTypeCode, safe);
    if (key) {
      const fromIndex = lookup.mergeIndex.get(key);
      if (fromIndex) return fromIndex;
    }
  }

  return null;
}

export function resolveLegacyPolicyDocumentFile(
  lookup: LegacyDocumentLookupContext,
  doc: { filename: string; documentTypeCode: string },
): string | null {
  return resolveLegacyDocumentFile(
    lookup.roots,
    doc.filename,
    doc.documentTypeCode,
    lookup,
  );
}
