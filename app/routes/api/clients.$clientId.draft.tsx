import { clientDraftSchema, formValuesToClientInput } from "~/lib/zod/client";
import {
  deleteClient,
  getClient,
  updateClient,
} from "~/lib/services/clients/service";
import type { Route } from "./+types/clients.$clientId.draft";

/** Browser client draft-save / discard endpoint (Postgres via Drizzle). */
export async function action({ request, params }: Route.ActionArgs) {
  const clientId = Number(params.clientId);

  if (request.method === "DELETE") {
    try {
      await deleteClient(clientId);
      return Response.json({ ok: true });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          formError:
            error instanceof Error ? error.message : "Could not discard client",
        },
        { status: 400 },
      );
    }
  }

  if (request.method !== "PUT" && request.method !== "POST") {
    return Response.json(
      { ok: false, formError: "Method not allowed" },
      { status: 405 },
    );
  }

  const body = (await request.json()) as unknown;
  const parsed = clientDraftSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      formError: "Client could not be saved. Check the form and try again.",
    });
  }

  const existing = await getClient(clientId);
  if (!existing) {
    return Response.json(
      { ok: false, formError: "Client not found" },
      { status: 404 },
    );
  }

  await updateClient(clientId, formValuesToClientInput(parsed.data));
  return Response.json({ ok: true, savedAt: new Date().toISOString() });
}
