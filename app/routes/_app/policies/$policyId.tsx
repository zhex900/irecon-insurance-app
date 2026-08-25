import { CopyIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useActionData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { toast } from "sonner";

import { DeletePoliciesDialog } from "~/components/policies/delete-policies-dialog";
import { PolicyWizard } from "~/components/policies/wizard/wizard";
import {
  allowWizardLeave,
  clearWizardStepState,
} from "~/components/policies/wizard/wizard-step-memory";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { usePolicyFeeNames, usePolicyNoteAuthors } from "~/hooks/policy";
import { withSuccessToast } from "~/hooks/utilities";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import {
  clientNotFoundResponse,
  policyNotFoundResponse,
} from "~/lib/http/resource-not-found";
import {
  parseFormIntent,
  parsePositiveInteger,
  parseUuid,
} from "~/lib/http/route-input";
import { trackUsage } from "~/lib/observability/metrics.server";
import { referenceData } from "~/lib/reference-data";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getClient } from "~/lib/services/clients/service";
import { deletePolicies, getPolicy } from "~/lib/services/policy/data.service";
import {
  addPolicyNote,
  applyPremiumCalculation,
  clonePolicy,
  PolicySaveError,
  savePolicyDraft,
  updatePolicyNote,
  upsertPolicyFromForm,
} from "~/lib/services/policy/orchestration.service";
import { resolveNoteAuthors } from "~/lib/services/users/service";
import {
  carPolicyDraftSchema,
  type CarPolicyFormValues,
  carPolicyPricingSchema,
  carPolicySchema,
  isTerminalStatus,
  parsePremiumOverride,
  POLICY_STATUS,
} from "~/lib/zod/policy-car";

import type { Route } from "./+types/$policyId";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: pageTitle(`${loaderData.policy.policyNumber}`) }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) throw policyNotFoundResponse();
  const policy = await getPolicy(policyId);
  if (!policy) throw policyNotFoundResponse();
  const client = await getClient(policy.clientId);
  if (!client) throw clientNotFoundResponse();

  return {
    policy,
    clientName: client.name,
  };
}

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) return { formError: "Invalid policy id." };
  const formData = await request.formData();
  const intent = parseFormIntent(
    formData,
    [
      "save",
      "clone",
      "delete",
      "add-note",
      "update-note",
      "draft",
      "recalculate",
      "calculate",
    ],
    "save",
  );
  if (!intent) return { formError: "Unknown action." };

  if (intent === "clone") {
    const source = await getPolicy(policyId);
    if (!source || !isTerminalStatus(source.policyStatusId)) {
      throw new Response("Only taken or not taken policies can be cloned.", {
        status: 400,
      });
    }
    const cloned = await clonePolicy(policyId, actor.email);
    await writeAuditLog({
      actor,
      action: "policy.clone",
      entityType: "policy",
      entityId: cloned.policyId,
      summary: `Cloned policy ${source.policyNumber} → ${cloned.policyNumber}`,
      metadata: {
        sourcePolicyId: policyId,
        sourcePolicyNumber: source.policyNumber,
        policyNumber: cloned.policyNumber,
      },
      request,
    });
    return redirect(
      withSuccessToast(
        `/policies/${cloned.policyId}?cloned=1`,
        `Policy cloned · ${cloned.policyNumber}. You are editing the new copy.`,
      ),
    );
  }

  if (intent === "delete") {
    try {
      const [deleted] = await deletePolicies([policyId], {
        userId: actor.userId,
      });

      await writeAuditLog({
        actor,
        action: "policy.delete",
        entityType: "policy",
        entityId: policyId,
        summary: `Deleted policy ${deleted.policyNumber}`,
        metadata: {
          clientId: deleted.clientId,
          policyNumber: deleted.policyNumber,
        },
        request,
      });
      return redirect(
        withSuccessToast(
          `/clients/${deleted.clientId}`,
          `Policy ${deleted.policyNumber} deleted`,
        ),
      );
    } catch (error) {
      return {
        formError: publicErrorMessage(error, {
          fallback: "Could not delete policy.",
          operation: "policy_delete",
        }),
      };
    }
  }

  if (intent === "add-note") {
    const description = String(formData.get("description") ?? "");
    try {
      const policy = await addPolicyNote(
        policyId,
        description,
        actor.email || actor.fullName,
      );
      await writeAuditLog({
        actor,
        action: "policy.note_add",
        entityType: "policy",
        entityId: policyId,
        summary: `Added note on ${policy.policyNumber}`,
        metadata: { policyNumber: policy.policyNumber },
        request,
      });
      return {
        ok: true as const,
        notes: policy.notes,
        noteAuthors: await resolveNoteAuthors(
          (policy.notes ?? []).map((note) => note.createdBy),
        ),
        message: `Note saved on ${policy.policyNumber}`,
      };
    } catch (error) {
      return {
        formError: publicErrorMessage(error, {
          fallback: "Could not add note.",
          operation: "policy_note_add",
        }),
      };
    }
  }

  if (intent === "update-note") {
    const description = String(formData.get("description") ?? "");
    const policyNoteId = parsePositiveInteger(formData.get("policyNoteId"));
    if (!policyNoteId) {
      return { formError: "Invalid note." };
    }
    try {
      const policy = await updatePolicyNote(
        policyId,
        policyNoteId,
        description,
      );
      await writeAuditLog({
        actor,
        action: "policy.note_update",
        entityType: "policy",
        entityId: policyId,
        summary: `Updated note on ${policy.policyNumber}`,
        metadata: { policyNumber: policy.policyNumber, policyNoteId },
        request,
      });
      return {
        ok: true as const,
        notes: policy.notes,
        noteAuthors: await resolveNoteAuthors(
          (policy.notes ?? []).map((note) => note.createdBy),
        ),
        message: `Note updated on ${policy.policyNumber}`,
      };
    } catch (error) {
      return {
        formError: publicErrorMessage(error, {
          fallback: "Could not update note.",
          operation: "policy_note_update",
        }),
      };
    }
  }

  const payload = parsePayload(String(formData.get("payload") ?? "{}"));

  if (intent === "draft") {
    const parsed = carPolicyDraftSchema.safeParse(payload);
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors };
    }
    try {
      await savePolicyDraft(policyId, parsed.data);
    } catch (error) {
      if (error instanceof PolicySaveError) {
        return { formError: error.message };
      }
      throw error;
    }
    return {
      ok: true as const,
      savedAt: new Date().toISOString(),
      draft: true as const,
    };
  }

  if (intent === "recalculate" || intent === "calculate") {
    const requestId = parsePositiveInteger(formData.get("requestId"));
    const parsed = carPolicyPricingSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        errors: parsed.error.flatten().fieldErrors,
        ...(requestId != null ? { requestId } : {}),
      };
    }
    const policy = await applyPremiumCalculation(
      policyId,
      parsed.data as CarPolicyFormValues,
      actor.email,
    );
    return {
      premium: policy.car.premium,
      referralReasons: policy.car.referralReasons,
      rating: policy.car.rating,
      notes: policy.notes,
      ...(requestId != null ? { requestId } : {}),
    };
  }

  const parsed = carPolicySchema.safeParse(payload);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Full schema strips premium; re-attach manual override from the raw payload.
  const premiumOverride = parsePremiumOverride(payload);

  const before = await getPolicy(policyId);
  let saved;
  try {
    saved = await upsertPolicyFromForm(
      policyId,
      {
        ...parsed.data,
        ...(premiumOverride ? { premium: premiumOverride } : {}),
      },
      actor.email,
    );
  } catch (error) {
    if (error instanceof PolicySaveError) {
      return { formError: error.message };
    }
    throw error;
  }

  const statusChanged =
    before != null &&
    Number(before.policyStatusId) !== Number(parsed.data.policyStatusId);

  if (statusChanged) {
    trackUsage("policy.submit", {
      result: "success",
      status_changed: true,
      to_status: statusLabel(parsed.data.policyStatusId),
    });
    await writeAuditLog({
      actor,
      action: "policy.status_change",
      entityType: "policy",
      entityId: policyId,
      summary: `Changed status on ${before?.policyNumber ?? policyId}: ${before?.policyStatusId} → ${parsed.data.policyStatusId}`,
      metadata: {
        fromStatusId: before?.policyStatusId,
        toStatusId: parsed.data.policyStatusId,
        policyNumber: before?.policyNumber,
      },
      request,
    });
  } else {
    trackUsage("policy.submit", {
      result: "success",
      status_changed: false,
      to_status: statusLabel(parsed.data.policyStatusId),
    });
    await writeAuditLog({
      actor,
      action: "policy.save",
      entityType: "policy",
      entityId: policyId,
      summary: `Saved policy ${before?.policyNumber ?? policyId}`,
      metadata: { policyNumber: before?.policyNumber },
      request,
    });
  }

  return {
    ok: true as const,
    intent: "save" as const,
    policy: saved,
    message: statusChanged
      ? `Policy ${saved.policyNumber} status saved`
      : `Policy ${saved.policyNumber} saved`,
  };
}

function statusLabel(statusId: number): string {
  if (statusId === POLICY_STATUS.Taken) return "taken";
  if (statusId === POLICY_STATUS.NotTaken) return "not_taken";
  if (statusId === POLICY_STATUS.Pending) return "pending";
  return "other";
}

export function shouldRevalidate({
  formData,
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const intent = formData?.get("intent");
  if (
    intent === "draft" ||
    intent === "save" ||
    intent === "add-note" ||
    intent === "update-note" ||
    intent === "recalculate" ||
    intent === "calculate"
  ) {
    return false;
  }
  if (
    actionResult &&
    typeof actionResult === "object" &&
    "draft" in actionResult &&
    actionResult.draft
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function PolicyDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const [policy, setPolicy] = useState(loaderData.policy);
  const [prevLoaderPolicy, setPrevLoaderPolicy] = useState(loaderData.policy);
  if (prevLoaderPolicy !== loaderData.policy) {
    setPrevLoaderPolicy(loaderData.policy);
    setPolicy(loaderData.policy);
  }
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [initialIsNew] = useState(() => searchParams.get("new") === "1");

  const { feeNames, pending: feeNamesPending } = usePolicyFeeNames(
    policy.dateStart,
  );
  const reference = useMemo(
    () => ({
      ...referenceData,
      feeNames: feeNames ?? [],
    }),
    [feeNames],
  );
  const hasNotes = (policy.notes ?? []).length > 0;
  const { noteAuthors } = usePolicyNoteAuthors(policy.policyId, hasNotes);

  const readOnly = isTerminalStatus(policy.policyStatusId);
  const canAdjust =
    policy.policyStatusId === POLICY_STATUS.Taken &&
    Boolean(policy.car.premium);
  const canClone = readOnly;
  const canDelete = !readOnly;
  const isCloning =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "clone";
  const isDeleting =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "delete";
  const wasCloned = searchParams.get("cloned") === "1";
  const clearedCloneForPolicyId = useRef<string | null>(null);
  const deleteError =
    actionData && "formError" in actionData ? actionData.formError : null;

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!wasCloned) return;
    if (clearedCloneForPolicyId.current === policy.policyId) return;
    clearWizardStepState(policy.policyId);
    clearedCloneForPolicyId.current = policy.policyId;
  }, [wasCloned, policy.policyId]);

  const lastDeleteErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deleteError || deleteOpen) return;
    if (lastDeleteErrorRef.current === deleteError) return;
    lastDeleteErrorRef.current = deleteError;
    toast.error("Could not delete", { description: deleteError });
  }, [deleteError, deleteOpen]);

  const headerActions: ReactNode =
    canAdjust || canClone || canDelete ? (
      <div className="flex items-center gap-2">
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        ) : null}
        {canAdjust ? (
          <Link to={`/policies/${policy.policyId}/adjust`}>
            <Button size="sm">
              <SlidersHorizontalIcon data-icon="inline-start" />
              {policy.car.adjusted ? "Re-adjust" : "Adjust"}
            </Button>
          </Link>
        ) : null}
        {canClone ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <LoadingButton
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isCloning}
                  onClick={() => {
                    submit({ intent: "clone" }, { method: "post" });
                  }}
                />
              }
            >
              <CopyIcon data-icon="inline-start" />
              Clone
            </TooltipTrigger>
            <TooltipContent>Clone policy</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    ) : null;

  return (
    <div>
      <PolicyWizard
        key={`${policy.policyId}-${wasCloned ? "cloned" : "view"}`}
        policy={policy}
        onPolicyUpdated={setPolicy}
        reference={reference}
        referenceFeeNamesPending={feeNamesPending}
        freshSteps={wasCloned}
        initialIsNew={initialIsNew}
        clientName={loaderData.clientName}
        noteAuthors={noteAuthors}
        headerActions={headerActions}
      />
      <DeletePoliciesDialog
        policies={[
          {
            policyId: policy.policyId,
            policyNumber: policy.policyNumber,
          },
        ]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        loading={isDeleting}
        error={deleteOpen ? deleteError : null}
        onBeforeSubmit={() => {
          clearWizardStepState(policy.policyId);
          allowWizardLeave(policy.policyId);
        }}
      />
    </div>
  );
}
