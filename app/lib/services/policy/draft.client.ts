import { reportClientRouteError } from "~/lib/observability/report-error";
import { mergeDraftIntoPolicy } from "~/lib/services/policy/draft-merge";
import type {
  DraftDiscardResult,
  DraftSaveResult,
} from "~/lib/services/shared/draft-result";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import { carPolicyDraftSchema } from "~/lib/zod/policy-car";

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

  try {
    const response = await fetch(`/api/policies/${policyId}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    let data: PolicyDraftSaveResult;
    try {
      data = (await response.json()) as PolicyDraftSaveResult;
    } catch {
      const error = new Error(
        `policy_draft_save_invalid_response:${response.status}`,
      );
      reportClientRouteError(error);
      return {
        ok: false,
        formError: "Draft could not be saved. Check your connection.",
      };
    }

    if (!response.ok || !data.ok) {
      const formError =
        data.ok === false
          ? data.formError
          : "Draft could not be saved. Try again.";
      if (response.status >= 500) {
        reportClientRouteError(
          new Error(formError ?? `policy_draft_save_failed:${response.status}`),
        );
      }
      if (data.ok === false) return data;
      return {
        ok: false,
        formError: formError ?? "Draft could not be saved. Try again.",
      };
    }

    return data;
  } catch (error) {
    reportClientRouteError(error);
    return {
      ok: false,
      formError: "Draft could not be saved. Check your connection.",
    };
  }
}

/** Discard an unsaved new-policy draft (Pending + isDraft only). */
export async function discardPolicyDraftClient(
  policyId: string,
): Promise<DraftDiscardResult> {
  try {
    const response = await fetch(`/api/policies/${policyId}/draft`, {
      method: "DELETE",
    });
    return (await response.json()) as DraftDiscardResult;
  } catch (error) {
    reportClientRouteError(error);
    return {
      ok: false,
      formError: "Could not discard policy",
    };
  }
}
