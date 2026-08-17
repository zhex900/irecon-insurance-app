import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import type { AppUser } from "~/lib/db/types";

/** User-facing copy when an authenticated user hits a page they cannot open. */
export const UNAUTHORIZED_PAGE_MESSAGE =
  "You are not authorised for this page.";

/**
 * Abort the loader/action with HTTP 403 so ErrorBoundary / RootErrorBoundary can
 * explain the denial (instead of a silent redirect or fake 404).
 */
export function throwUnauthorizedPage(
  message: string = UNAUTHORIZED_PAGE_MESSAGE,
): never {
  throw new Response(message, {
    status: 403,
    statusText: "Forbidden",
  });
}

/** Admin or super-admin only (e.g. User Management). */
export function requireAdminPage(user: Pick<AppUser, "role">): void {
  if (!isAdminRole(user)) throwUnauthorizedPage();
}

/** Super-admin only (e.g. Features). */
export function requireSuperAdminPage(user: Pick<AppUser, "role">): void {
  if (!isSuperAdmin(user)) throwUnauthorizedPage();
}

/**
 * Feature flag must be on, unless the viewer is a super-admin
 * (super-admins can open disabled settings for ops).
 */
export function requireFeatureOrSuperAdminPage(
  enabled: boolean,
  user: Pick<AppUser, "role">,
): void {
  if (!enabled && !isSuperAdmin(user)) throwUnauthorizedPage();
}
