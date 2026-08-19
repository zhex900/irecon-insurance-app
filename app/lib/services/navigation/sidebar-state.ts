const SIDEBAR_COOKIE_NAME = "sidebar_state";
const RECENTS_OPEN_COOKIE_NAME = "recents_open";
const NAV_SECTIONS_COOKIE_NAME = "nav_sections";
const SHELL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type NavSectionId = "reports" | "settings";

function readCookieValue(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1];
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value}; path=/; max-age=${SHELL_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Reports / Settings section for the current path (SSR-safe). */
export function sectionFromPathname(pathname: string): NavSectionId | null {
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "reports";
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "settings";
  }
  return null;
}

/** Parse pinned sidebar open state from the request Cookie header (SSR / loaders). */
export function readSidebarOpenFromRequest(request: Request): boolean {
  return readSidebarOpenFromCookieHeader(request.headers.get("Cookie"));
}

export function readSidebarOpenFromCookieHeader(
  cookieHeader: string | null,
): boolean {
  const value = readCookieValue(cookieHeader, SIDEBAR_COOKIE_NAME);
  if (value === "false") return false;
  if (value === "true") return true;
  return true;
}

/** Parse Recents section open state from the request Cookie header (SSR / loaders). */
export function readRecentsOpenFromRequest(request: Request): boolean {
  return readRecentsOpenFromCookieHeader(request.headers.get("Cookie"));
}

export function readRecentsOpenFromCookieHeader(
  cookieHeader: string | null,
): boolean {
  return readCookieValue(cookieHeader, RECENTS_OPEN_COOKIE_NAME) === "1";
}

export function readNavSectionsFromRequest(request: Request): NavSectionId[] {
  return readNavSectionsFromCookieHeader(request.headers.get("Cookie"));
}

export function readNavSectionsFromCookieHeader(
  cookieHeader: string | null,
): NavSectionId[] {
  const value = readCookieValue(cookieHeader, NAV_SECTIONS_COOKIE_NAME);
  if (!value) return [];
  return value
    .split(",")
    .filter(
      (part): part is NavSectionId => part === "reports" || part === "settings",
    );
}

/**
 * Expanded Reports/Settings for SSR first paint only.
 * Cookie state plus the active path section so a deep link shows its submenu.
 * Client navigations must not auto expand/collapse — only the user toggle.
 */
export function resolveNavSectionsExpanded(
  request: Request,
  pathname: string,
): NavSectionId[] {
  const expanded = new Set(readNavSectionsFromRequest(request));
  const active = sectionFromPathname(pathname);
  if (active) expanded.add(active);
  return [...expanded];
}

/**
 * Shell nav state for SSR. Recents list only renders when the sidebar is expanded,
 * so keep sidebar open whenever recents are open.
 */
export function resolveShellNavState(request: Request): {
  sidebarOpen: boolean;
  recentsOpen: boolean;
} {
  const recentsOpen = readRecentsOpenFromRequest(request);
  const sidebarOpen = readSidebarOpenFromRequest(request);
  return {
    recentsOpen,
    sidebarOpen: recentsOpen ? true : sidebarOpen,
  };
}

/** Persist Recents open state for SSR on the next document load. */
export function writeRecentsOpenCookie(open: boolean) {
  writeCookie(RECENTS_OPEN_COOKIE_NAME, open ? "1" : "0");
}

export function writeSidebarOpenCookie(open: boolean) {
  writeCookie(SIDEBAR_COOKIE_NAME, open ? "true" : "false");
}

/** Persist expanded nav sections for SSR on the next document load. */
export function writeNavSectionsCookie(sections: NavSectionId[]) {
  writeCookie(NAV_SECTIONS_COOKIE_NAME, sections.join(","));
}
