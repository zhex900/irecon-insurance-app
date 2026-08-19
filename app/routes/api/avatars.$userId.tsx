import { requireAuth } from "~/lib/auth/session/server.server";
import { getAvatarsBucket } from "~/lib/cloudflare.server";
import { getUser } from "~/lib/services/users/service";
import { getUserAvatarObject } from "~/lib/storage/avatars.server";

import type { Route } from "./+types/avatars.$userId";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireAuth(request);
  const userId = params.userId?.trim();
  if (!userId) {
    throw new Response("Not found", { status: 404 });
  }

  const user = await getUser(userId);
  if (!user?.avatarR2Key) {
    throw new Response("Not found", { status: 404 });
  }

  const bucket = getAvatarsBucket(context);
  if (!bucket) {
    throw new Response("Avatar storage unavailable", { status: 503 });
  }

  const object = await getUserAvatarObject(bucket, userId);
  if (!object?.body) {
    throw new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  if (!headers.has("Content-Type")) {
    headers.set(
      "Content-Type",
      object.httpMetadata?.contentType ?? "application/octet-stream",
    );
  }
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
