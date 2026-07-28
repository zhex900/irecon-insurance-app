import { requireAuth } from "~/lib/auth/session.server";
import { listLibraryDocuments } from "~/lib/services/documents/library-documents";
import type { Route } from "./+types/library-documents";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return Response.json({ documents: await listLibraryDocuments() });
}
