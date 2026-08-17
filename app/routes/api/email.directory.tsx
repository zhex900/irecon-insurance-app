import { requireAuth } from "~/lib/auth/session/server.server";
import { listEmailDirectory } from "~/lib/services/email/directory.server";

import type { Route } from "./+types/email.directory";

/** GET /api/email/directory — users, ARs, and clients for email To/Cc autocomplete. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const directory = await listEmailDirectory();
  return Response.json(directory);
}
