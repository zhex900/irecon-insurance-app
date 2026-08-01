/** Shared Recents path helpers (safe for client + server). */

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

/** Normalize and validate a path for the recents stack. */
export function normalizeRecentPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  let path = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.length === 0 || path.length > 512) return null;
  if (path === "/") return "/dashboard";
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

/** Caption under Recents rows for entity pages. */
export function recentCaptionForPath(path: string): string | undefined {
  if (/^\/clients\/\d+(?:\/|$)/.test(path)) return "Client";
  if (/^\/policies\/\d+(?:\/|$)/.test(path)) return "Policy";
  return undefined;
}

/** Optimistic client-side label until the API resolves the real one. */
export function recentLabelFallback(path: string, previous?: string): string {
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
