/** Shared Recents path helpers (safe for client + server). */

import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_META,
  type EmailTemplateKey,
} from "~/lib/email-templates";
import { isPriceCatalogueSlug, slugLabel } from "~/lib/prices/settings-shared";

export const RECENT_ROUTES_MAX = 5;

const SKIP_PREFIXES = [
  "/api/",
  "/login",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/auth/",
] as const;

export type RecentRouteLink = {
  id: string;
  label: string;
  href: string;
  caption?: string;
};

/**
 * Leaf page under a root nav item.
 * Recents row: **label** = find/leaf page, **caption** = root nav label.
 *
 * Add an entry when a new nested menu should appear this way in Recents.
 */
export type RecentLeafSection = {
  /** Root nav path, e.g. `/settings/email-templates`. */
  rootPath: string;
  /** Side-nav root label used as Recents subtext. */
  rootLabel: string;
  /**
   * Extract the leaf id from a path under `rootPath`.
   * Return null for the root itself or non-matching paths.
   * Default: first path segment after `rootPath`.
   */
  matchLeaf?: (path: string) => string | null;
  /** Sync leaf label (optimistic client + server when no async lookup). */
  leafLabel: (leafId: string) => string;
};

function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

/** Pretty-print a slug/key when the real title is not available yet. */
export function recentTemplateNameFromKey(key: string): string {
  return decodeURIComponent(key).replace(/[-_]/g, " ").trim() || key;
}

function defaultMatchLeaf(rootPath: string, path: string): string | null {
  if (path === rootPath) return null;
  const prefix = `${rootPath}/`;
  if (!path.startsWith(prefix)) return null;
  const leaf = path.slice(prefix.length).split("/")[0];
  if (!leaf) return null;
  return decodeURIComponent(leaf);
}

/**
 * Nested menus that use leaf-as-label / root-as-caption in Recents.
 * Keep `rootLabel` in sync with the side nav item label.
 */
export const RECENT_LEAF_SECTIONS: readonly RecentLeafSection[] = [
  {
    rootPath: "/settings/email-templates",
    rootLabel: "Email Templates",
    leafLabel: (key) =>
      isEmailTemplateKey(key)
        ? EMAIL_TEMPLATE_META[key].title
        : recentTemplateNameFromKey(key),
  },
  {
    rootPath: "/settings/document-templates",
    rootLabel: "Document Templates",
    leafLabel: (key) => recentTemplateNameFromKey(key),
  },
  {
    rootPath: "/settings/prices",
    rootLabel: "Prices",
    leafLabel: (slug) =>
      isPriceCatalogueSlug(slug)
        ? slugLabel(slug)
        : recentTemplateNameFromKey(slug),
  },
];

export function matchRecentLeafSection(
  path: string,
): { section: RecentLeafSection; leafId: string } | null {
  for (const section of RECENT_LEAF_SECTIONS) {
    const leafId = (
      section.matchLeaf ?? ((p) => defaultMatchLeaf(section.rootPath, p))
    )(path);
    if (leafId) return { section, leafId };
  }
  return null;
}

/** Normalize and validate a path for the recents stack. */
export function normalizeRecentPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  let path = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.length === 0 || path.length > 512) return null;
  // Home / dashboard are not useful in Recents.
  if (path === "/" || path === "/dashboard") return null;
  for (const prefix of SKIP_PREFIXES) {
    if (path === prefix.replace(/\/$/, "") || path.startsWith(prefix)) {
      return null;
    }
  }
  return path;
}

export function recentIdForPath(path: string): string {
  return `recent-${encodeURIComponent(path)}`;
}

/**
 * Caption under Recents rows.
 * Leaf sections → root nav label. Client/Policy → entity type.
 */
export function recentCaptionForPath(path: string): string | undefined {
  const leaf = matchRecentLeafSection(path);
  if (leaf) return leaf.section.rootLabel;

  if (/^\/clients\/\d+(?:\/|$)/.test(path)) return "Client";
  if (/^\/policies\/\d+(?:\/|$)/.test(path)) return "Policy";

  return undefined;
}

/** Optimistic client-side label until the API resolves the real one. */
export function recentLabelFallback(path: string, previous?: string): string {
  const leaf = matchRecentLeafSection(path);
  if (leaf) {
    const prev = previous?.trim();
    // Keep a previously resolved leaf title; drop stale parent/type labels.
    if (
      prev &&
      prev !== leaf.section.rootLabel &&
      prev !== "Email Template" &&
      prev !== "Document Template"
    ) {
      return prev;
    }
    return leaf.section.leafLabel(leaf.leafId);
  }

  if (previous?.trim()) return previous.trim();
  if (/^\/clients\/\d+(?:\/|$)/.test(path)) {
    return `Client ${path.split("/")[2] ?? ""}`.trim();
  }
  if (/^\/policies\/\d+(?:\/|$)/.test(path)) {
    return `Policy ${path.split("/")[2] ?? ""}`.trim();
  }
  const segment = path.split("/").filter(Boolean).pop() ?? path;
  return decodeURIComponent(segment).replace(/[-_]/g, " ");
}

/** Move `path` to the front of a Recents stack (max 5). */
export function pushRecentRouteLocal(
  routes: RecentRouteLink[],
  path: string,
): RecentRouteLink[] {
  return pushRecentRouteLocalDetailed(routes, path).routes;
}

/**
 * Like {@link pushRecentRouteLocal}, but also returns the row dropped off the
 * end (if any) so the UI can keep it mounted while the insert animates down.
 */
export function pushRecentRouteLocalDetailed(
  routes: RecentRouteLink[],
  path: string,
): { routes: RecentRouteLink[]; spilled: RecentRouteLink | null } {
  const existing = routes.find((route) => route.href === path);
  const next: RecentRouteLink = {
    id: recentIdForPath(path),
    href: path,
    label: recentLabelFallback(path, existing?.label),
    caption: recentCaptionForPath(path),
  };
  const stacked = [next, ...routes.filter((route) => route.href !== path)];
  const spilled =
    stacked.length > RECENT_ROUTES_MAX
      ? (stacked[RECENT_ROUTES_MAX] ?? null)
      : null;
  return {
    routes: stacked.slice(0, RECENT_ROUTES_MAX),
    spilled,
  };
}
