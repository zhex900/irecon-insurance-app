import type { R2BucketLike } from "~/lib/cloudflare.server";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function avatarObjectKey(userId: string) {
  return `users/${userId}/avatar`;
}

export async function putUserAvatar(
  bucket: R2BucketLike,
  userId: string,
  file: File,
) {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Avatar must be a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("Avatar must be between 1 byte and 2 MB.");
  }

  const key = avatarObjectKey(userId);
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=3600",
    },
  });
  // Version token so browsers refresh after replace.
  return `${key}:${Date.now()}`;
}

export async function deleteUserAvatar(bucket: R2BucketLike, userId: string) {
  await bucket.delete(avatarObjectKey(userId));
}

export async function getUserAvatarObject(
  bucket: R2BucketLike,
  userId: string,
) {
  return bucket.get(avatarObjectKey(userId));
}
