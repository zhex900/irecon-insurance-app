import { z } from "zod";
import { requireAuth } from "~/lib/auth/session/server.server";
import {
  listRecentRoutes,
  pushRecentRoute,
} from "~/lib/services/navigation/recent-routes.server";
import type { Route } from "./+types/recent-routes";

const postSchema = z.object({
  path: z.string().min(1).max(512),
});

/** GET — current Recents stack for the signed-in user. */
export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const routes = await listRecentRoutes(viewer.userId);
  return Response.json({ routes });
}

/** POST — push a path onto the Recents stack (newest first, max 5). */
export async function action({ request }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const parsed = postSchema.safeParse({
    path: String(formData.get("path") ?? ""),
  });
  if (!parsed.success) {
    return Response.json({ error: "Invalid path." }, { status: 400 });
  }

  const routes = await pushRecentRoute(viewer.userId, parsed.data.path);
  return Response.json({ ok: true as const, routes });
}
