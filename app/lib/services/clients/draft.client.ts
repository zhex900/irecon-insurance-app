import {
  clientDraftSchema,
  clientSchema,
  type ClientFormValues,
} from "~/lib/zod/client";
import type {
  DraftDiscardResult,
  DraftSaveResult,
} from "~/lib/services/shared/draft-result";

export type ClientDraftSaveResult = DraftSaveResult;

/**
 * Persist a client via the app API (Supabase/Postgres through the RR action).
 * Pass `requireComplete` for new-client Save (blocks empty / incomplete forms).
 */
export async function saveClientDraftClient(
  clientId: string,
  values: ClientFormValues,
  options?: { requireComplete?: boolean },
): Promise<ClientDraftSaveResult> {
  const schema = options?.requireComplete ? clientSchema : clientDraftSchema;
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      formError: "Client could not be saved. Check the form and try again.",
    };
  }

  const response = await fetch(`/api/clients/${clientId}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  return (await response.json()) as ClientDraftSaveResult;
}

/** Discard an unsaved new-client draft (0 policies only). */
export async function discardClientDraftClient(
  clientId: string,
): Promise<DraftDiscardResult> {
  const response = await fetch(`/api/clients/${clientId}/draft`, {
    method: "DELETE",
  });
  return (await response.json()) as DraftDiscardResult;
}
