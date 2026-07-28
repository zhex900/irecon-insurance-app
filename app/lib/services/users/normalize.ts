import { normalizeAppRole } from "~/lib/auth/roles";
import { appUser } from "~/lib/db/schema";
import type { AppUser } from "~/lib/db/types";

/** Map an `app_user` row to the app DTO. */
export function normalizeAppUser(row: typeof appUser.$inferSelect): AppUser {
  const arId = row.authorisedRepresentativeId;
  return {
    userId: row.userId,
    fullName: row.fullName ?? "",
    email: row.email ?? "",
    role: normalizeAppRole(row.role),
    authorisedRepresentativeId:
      arId == null || Number(arId) < 1 ? null : Number(arId),
    disabled: Boolean(row.disabled),
    avatarR2Key: row.avatarR2Key ?? null,
    createdWhen: row.createdWhen.toISOString(),
  };
}
