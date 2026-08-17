import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROUTES_DIR = join(process.cwd(), "app/routes");

/** Routes that are intentionally reachable without a session. */
const PUBLIC_ROUTE_SUFFIXES = [
  "_auth/login.tsx",
  "_auth/logout.tsx",
  "_auth/forgot-password.tsx",
  "_auth/reset-password.tsx",
  "_auth/confirm.tsx",
  "_index.tsx",
  "$.tsx",
  "well-known.chrome-devtools.tsx",
];

/** Child routes that inherit auth from `routes/_app/layout.tsx` and have no loader/action. */
const LAYOUT_ONLY_ROUTE_SUFFIXES = ["_app/reports/_index.tsx"];

/** Server modules that enforce auth on delegated loader/action handlers. */
const DELEGATED_AUTH_MARKERS = [
  "loadEmailTemplateEditor",
  "emailTemplateAction",
  "loadDocumentTemplateEditor",
  "documentTemplateAction",
];

const DIRECT_AUTH_MARKERS = [
  "requireAuth(",
  "getSessionAppUser(",
  "getAuthUserWithSession(",
];

function listRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...listRouteFiles(path));
      continue;
    }
    if (entry.endsWith(".tsx")) files.push(path);
  }
  return files;
}

function hasLoaderOrAction(source: string): boolean {
  return (
    /export\s+async\s+function\s+loader\b/.test(source) ||
    /export\s+async\s+function\s+action\b/.test(source) ||
    /export\s+function\s+loader\b/.test(source) ||
    /export\s+function\s+action\b/.test(source)
  );
}

function hasAuthGuard(source: string): boolean {
  return (
    DIRECT_AUTH_MARKERS.some((marker) => source.includes(marker)) ||
    DELEGATED_AUTH_MARKERS.some((marker) => source.includes(marker))
  );
}

describe("route auth coverage", () => {
  it("every loader/action route calls requireAuth or delegates to an authed server handler", () => {
    const unguarded: string[] = [];

    for (const file of listRouteFiles(ROUTES_DIR)) {
      const rel = relative(ROUTES_DIR, file);
      if (
        PUBLIC_ROUTE_SUFFIXES.some((suffix) => rel.endsWith(suffix)) ||
        LAYOUT_ONLY_ROUTE_SUFFIXES.some((suffix) => rel.endsWith(suffix))
      ) {
        continue;
      }

      const source = readFileSync(file, "utf8");
      if (!hasLoaderOrAction(source)) continue;
      if (!hasAuthGuard(source)) unguarded.push(rel);
    }

    expect(unguarded).toEqual([]);
  });
});
