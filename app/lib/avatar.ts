import md5 from "md5";

/**
 * Avatar helpers — custom R2 avatar, else Gravatar from work email, else initials.
 */

export function userInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Gravatar URL for an email, or `undefined` if email looks invalid. */
export function gravatarUrl(email: string, size = 128): string | undefined {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return undefined;
  const hash = md5(normalized);
  // d=404 → AvatarImage fails when no Gravatar; initials fallback shows
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

export function avatarPublicPath(userId: string, cacheKey?: string | null) {
  const base = `/api/avatars/${userId}`;
  if (!cacheKey) return base;
  return `${base}?v=${encodeURIComponent(cacheKey)}`;
}
