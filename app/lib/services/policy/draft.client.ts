import { carPolicyDraftSchema } from "~/lib/zod/policy-car";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import { mergeDraftIntoPolicy } from "~/lib/services/policy/draft-merge";
import type {
  DraftDiscardResult,
  DraftSaveResult,
} from "~/lib/services/shared/draft-result";

export { mergeDraftIntoPolicy };

export type PolicyDraftSaveResult = DraftSaveResult;

/**
 * Persist a draft via the app API (Supabase/Postgres through the RR action).
 * Does not trigger React Router revalidation.
 */
export async function savePolicyDraftClient(
  policyId: string,
  values: CarPolicyFormValues & {
    premium?: Record<string, number>;
    premiumManualKeys?: string[];
  },
): Promise<PolicyDraftSaveResult> {
  const parsed = carPolicyDraftSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first
      ? `${first.path.join(".") || "form"}: ${first.message}`
      : undefined;
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      formError: detail
        ? `Draft could not be saved (${detail}).`
        : "Draft could not be saved. Check the form and try again.",
    };
  }

  const response = await fetch(`/api/policies/${policyId}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  const data = (await response.json()) as PolicyDraftSaveResult;
  return data;
}

/** Discard an unsaved new-policy draft (Pending + isDraft only). */
export async function discardPolicyDraftClient(
  policyId: string,
): Promise<DraftDiscardResult> {
  const response = await fetch(`/api/policies/${policyId}/draft`, {
    method: "DELETE",
  });
  return (await response.json()) as DraftDiscardResult;
}
