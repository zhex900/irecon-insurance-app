/** Shared Recents path helpers (safe for client + server). */

import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_META,
  type EmailTemplateKey,
} from "~/lib/email/templates";
import { isPriceCatalogueSlug, slugLabel } from "~/lib/pricing/settings-shared";

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
  caption: string;
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

const UUID_SEGMENT = "[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}";
export const CLIENT_PATH_PATTERN = new RegExp(
  `^/clients/(${UUID_SEGMENT})(?:/|$)`,
);
export const POLICY_PATH_PATTERN = new RegExp(
  `^/policies/(${UUID_SEGMENT})(?:/|$)`,
);

export type RecentEntityRef =
  | { kind: "client"; id: string }
  | { kind: "policy"; id: string };

export const RECENT_ROUTES_CHANGED_EVENT = "irecon:recent-routes-changed";

const pendingRemovedEntities: RecentEntityRef[] = [];

/** Notify the shell to reload Recents from the API. */
export function notifyRecentRoutesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECENT_ROUTES_CHANGED_EVENT));
}

/** Queue an entity so the next navigation does not re-record it in Recents. */
export function markRecentEntityRemoved(entity: RecentEntityRef): void {
  if (typeof window === "undefined") return;
  pendingRemovedEntities.push(entity);
}

/**
 * Queue a removed entity and refresh Recents immediately.
 * Use when the shell loader will not revalidate (draft discard, etc.).
 */
export function markRecentEntityRemovedAndRefresh(
  entity: RecentEntityRef,
): void {
  markRecentEntityRemoved(entity);
  notifyRecentRoutesChanged();
}

/** Entities marked removed since the last navigation (consumed once). */
export function consumeRemovedRecentEntities(): RecentEntityRef[] {
  if (pendingRemovedEntities.length === 0) return [];
  return pendingRemovedEntities.splice(0);
}

export function recentEntityBasePath(entity: RecentEntityRef): string {
  return entity.kind === "client"
    ? `/clients/${entity.id}`
    : `/policies/${entity.id}`;
}

export function pathMatchesRecentEntity(
  path: string,
  entity: RecentEntityRef,
): boolean {
  const normalized = normalizeRecentPath(path);
  if (!normalized) return false;
  const base = recentEntityBasePath(entity);
  return normalized === base || normalized.startsWith(`${base}/`);
}

export function recentIdForPath(path: string): string {
  return `recent-${encodeURIComponent(path)}`;
}

/** Recents caption suffix for known entity sub-routes (e.g. client edit). */
export function recentSubpathCaptionSuffix(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.at(-1) === "edit") return " (edit)";
  return "";
}

/** Known app routes — label is the page title, caption is the parent nav section. */
export const STATIC_RECENT_ROUTES: Record<
  string,
  { label: string; caption: string }
> = {
  "/clients": { label: "Clients", caption: "Clients" },
  "/policies": { label: "Policies", caption: "Policies" },
  "/reports": { label: "Reports", caption: "Reports" },
  "/reports/car-policies": {
    label: "CAR Policy Report",
    caption: "Reports",
  },
  "/reports/car-renewals": {
    label: "CAR Renewal Report",
    caption: "Reports",
  },
  "/settings": { label: "Settings", caption: "Settings" },
  "/settings/users": { label: "User Management", caption: "Settings" },
  "/settings/ar-brokers": {
    label: "Authorised Representatives",
    caption: "Settings",
  },
  "/settings/account-managers": {
    label: "Account Managers",
    caption: "Settings",
  },
  "/settings/car-wording": {
    label: "Additional Wording",
    caption: "Settings",
  },
  "/settings/email-templates": {
    label: "Email Templates",
    caption: "Settings",
  },
  "/settings/library-documents": {
    label: "Library Documents",
    caption: "Settings",
  },
  "/settings/document-templates": {
    label: "Document Templates",
    caption: "Settings",
  },
  "/settings/features": { label: "Features", caption: "Settings" },
  "/settings/audit-log": { label: "Audit Log", caption: "Settings" },
  "/settings/prices": { label: "Prices", caption: "Settings" },
  "/settings/prices/car-rates": { label: "Prices", caption: "Settings" },
  "/profile": { label: "Profile", caption: "Profile" },
};

/**
 * Caption under Recents rows — parent nav section or entity type.
 */
export function recentCaptionForPath(path: string): string {
  const leaf = matchRecentLeafSection(path);
  if (leaf) return leaf.section.rootLabel;

  let caption: string;
  if (CLIENT_PATH_PATTERN.test(path)) caption = "Client";
  else if (POLICY_PATH_PATTERN.test(path)) caption = "Policy";
  else {
    const staticRoute = STATIC_RECENT_ROUTES[path];
    if (staticRoute) caption = staticRoute.caption;
    else if (path.startsWith("/settings/")) caption = "Settings";
    else if (path.startsWith("/reports/")) caption = "Reports";
    else if (path.startsWith("/clients/")) caption = "Client";
    else if (path.startsWith("/policies/")) caption = "Policy";
    else if (path.startsWith("/profile")) caption = "Profile";
    else caption = "Page";
  }

  return `${caption}${recentSubpathCaptionSuffix(path)}`;
}

/** Optimistic client-side label until the API resolves the real one. */
export function recentLabelFallback(path: string, previous?: string): string {
  const staticRoute = STATIC_RECENT_ROUTES[path];
  if (staticRoute) return staticRoute.label;

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
  // UUID ids are meaningless to read — wait for the API to resolve a name.
  if (CLIENT_PATH_PATTERN.test(path)) {
    return `Client${recentSubpathCaptionSuffix(path)}`;
  }
  if (POLICY_PATH_PATTERN.test(path)) return "Policy";
  const segment = path.split("/").filter(Boolean).pop() ?? path;
  return decodeURIComponent(segment).replace(/[-_]/g, " ");
}

/** Drop the active path from a Recents stack (client display / state). */
export function excludeRecentRoute(
  routes: RecentRouteLink[],
  pathname: string,
): RecentRouteLink[] {
  const current = normalizeRecentPath(pathname);
  if (!current) return routes;
  return routes.filter((route) => route.href !== current);
}

/** Drop every recent route for a deleted client or policy (incl. subpaths). */
export function excludeRecentRoutesForEntity(
  routes: RecentRouteLink[],
  entity: RecentEntityRef,
): RecentRouteLink[] {
  return routes.filter((route) => !pathMatchesRecentEntity(route.href, entity));
}

export function excludeRecentRoutesForEntities(
  routes: RecentRouteLink[],
  entities: RecentEntityRef[],
): RecentRouteLink[] {
  if (entities.length === 0) return routes;
  return routes.filter(
    (route) =>
      !entities.some((entity) => pathMatchesRecentEntity(route.href, entity)),
  );
}

export type LeaveNavigationUpdate = {
  routes: RecentRouteLink[];
  spilled: RecentRouteLink | null;
  enteringId: string | null;
  /** Path to POST to the server, or null when nothing should be recorded. */
  recordPath: string | null;
};

/**
 * Apply optimistic Recents updates when navigating from `previousPath` to
 * `nextPath`. Handles deleted/discarded entities and the max-stack animation.
 */
export function computeLeaveNavigation(
  currentRoutes: RecentRouteLink[],
  previousPath: string,
  nextPath: string,
  removedEntities: RecentEntityRef[],
): LeaveNavigationUpdate {
  const recordPath = normalizeRecentPath(previousPath);
  const skipRecord =
    recordPath != null &&
    removedEntities.some((entity) =>
      pathMatchesRecentEntity(recordPath, entity),
    );

  let base = excludeRecentRoute(currentRoutes, nextPath);
  base = excludeRecentRoutesForEntities(base, removedEntities);

  if (skipRecord || !recordPath) {
    return {
      routes: base,
      spilled: null,
      enteringId: null,
      recordPath: null,
    };
  }

  const { routes, spilled } = pushRecentRouteLocalDetailed(base, previousPath);
  return {
    routes,
    spilled,
    enteringId: recentIdForPath(previousPath),
    recordPath,
  };
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
