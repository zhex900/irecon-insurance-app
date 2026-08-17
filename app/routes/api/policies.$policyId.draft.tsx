import { requireAuth } from "~/lib/auth/session/server.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseUuid } from "~/lib/http/route-input";
import {
  POLICY_NUMBER_TAKEN_MESSAGE,
  validatePolicyNumberInput,
} from "~/lib/policies/policy-number";
import {
  deletePolicyDraft,
  getPolicy,
  isPolicyNumberTaken,
  savePolicy,
} from "~/lib/services/policy/data.service";
import { mergeDraftIntoPolicy } from "~/lib/services/policy/draft-merge";
import { carPolicyDraftSchema , POLICY_STATUS } from "~/lib/zod/policy-car";

import type { Route } from "./+types/policies.$policyId.draft";

/** Browser draft-save / discard endpoint (Postgres via Drizzle). */
export async function action({ request, params }: Route.ActionArgs) {
  await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) {
    return Response.json(
      { ok: false, formError: "Invalid policy id." },
      { status: 400 },
    );
  }

  if (request.method === "DELETE") {
    try {
      await deletePolicyDraft(policyId);
      return Response.json({ ok: true });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          formError: publicErrorMessage(error, {
            fallback: "Could not discard policy",
            operation: "policy_draft_discard",
          }),
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

  const body = await request.json().catch(() => null);
  const parsed = carPolicyDraftSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      formError: "Draft could not be saved. Check the form and try again.",
    });
  }

  const existing = await getPolicy(policyId);
  if (!existing) {
    return Response.json(
      { ok: false, formError: "Policy not found" },
      { status: 404 },
    );
  }
  if (
    existing.policyStatusId === POLICY_STATUS.Taken ||
    existing.policyStatusId === POLICY_STATUS.NotTaken
  ) {
    return Response.json({
      ok: false,
      formError: "This policy status cannot be changed.",
    });
  }

  const merged = mergeDraftIntoPolicy(existing, parsed.data);
  if (merged.policyNumber !== existing.policyNumber) {
    const validated = validatePolicyNumberInput(merged.policyNumber);
    if (!validated.ok) {
      return Response.json({
        ok: false,
        errors: { policyNumber: [validated.message] },
        formError: validated.message,
      });
    }
    if (await isPolicyNumberTaken(validated.policyNumber, policyId)) {
      return Response.json({
        ok: false,
        errors: { policyNumber: [POLICY_NUMBER_TAKEN_MESSAGE] },
        formError: POLICY_NUMBER_TAKEN_MESSAGE,
      });
    }
    merged.policyNumber = validated.policyNumber;
  }

  try {
    await savePolicy(merged);
    return Response.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        formError: publicErrorMessage(error, {
          fallback: "Draft could not be saved. Try again.",
          operation: "policy_draft_save",
        }),
      },
      { status: 500 },
    );
  }
}
