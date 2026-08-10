import type { AppUser } from "~/lib/db/types";

export const APP_ROLES = ["broker", "admin", "super-admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Roles selectable in User Management UI (super-admin is DB-only). */
export const UI_ASSIGNABLE_ROLES = ["broker", "admin"] as const;
export type UiAssignableRole = (typeof UI_ASSIGNABLE_ROLES)[number];

export function normalizeAppRole(value: string | null | undefined): AppRole {
  if (value === "super-admin") return "super-admin";
  if (value === "admin") return "admin";
  return "broker";
}

export function isSuperAdmin(
  user: Pick<AppUser, "role"> | null | undefined,
): boolean {
  return user?.role === "super-admin";
}

/** Admin or super-admin — can view all audit activity, etc. */
export function isAdminRole(
  user: Pick<AppUser, "role"> | null | undefined,
): boolean {
  return user?.role === "admin" || user?.role === "super-admin";
}

export function formatRoleLabel(role: AppRole | string): string {
  if (role === "super-admin") return "System admin";
  if (role === "admin") return "Admin";
  return "Broker";
}
