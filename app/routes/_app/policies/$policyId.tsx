import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  redirect,
  Link,
  useActionData,
  useNavigation,
  useSearchParams,
  useSubmit,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { toast } from "sonner";
import { CopyIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { CarPolicyWizard } from "~/components/policies/wizard/car-policy-wizard";
import {
  allowWizardLeave,
  clearWizardStepState,
} from "~/components/policies/wizard/step-memory";
import { DeletePoliciesDialog } from "~/components/policies/delete-policies-dialog";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { withSuccessToast } from "~/hooks/use-success-toast";
import {
  carPolicyDraftSchema,
  carPolicyPricingSchema,
  carPolicySchema,
  isTerminalStatus,
  parsePremiumOverride,
  POLICY_STATUS,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import { requireAuth } from "~/lib/auth/session.server";
import {
  parseFormIntent,
  parsePositiveInteger,
  parseUuid,
} from "~/lib/http/route-input";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  addPolicyNote,
  applyPremiumCalculation,
  clonePolicy,
  PolicySaveError,
  savePolicyDraft,
  updatePolicyNote,
  upsertPolicyFromForm,
} from "~/lib/services/policy/orchestration.service";
import { deletePolicies, getPolicy } from "~/lib/services/policy/data.service";
import { getAuthorisedRepresentative } from "~/lib/services/authorised-representatives/service";
import {
  getCarWording,
  getReferenceDataAsync,
} from "~/lib/services/reference.service";
import { getClient } from "~/lib/services/clients/service";
import { listEmailTemplates } from "~/lib/services/email/templates.server";
import { getEmailFooterImage } from "~/lib/services/email/footer-image.server";
import { listEmailDirectory } from "~/lib/services/email/directory.server";
import { emailVarsFromAccountManager } from "~/lib/email/templates";
import { resolveNoteAuthors } from "~/lib/services/users/service";
import type { Route } from "./+types/$policyId";
import { pageTitle } from "~/lib/brand";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: pageTitle(`${loaderData.policy.policyNumber}`) }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) throw new Response("Policy not found", { status: 404 });
  const policy = await getPolicy(policyId);
  if (!policy) throw new Response("Policy not found", { status: 404 });
  const client = await getClient(policy.clientId);
  if (!client) throw new Response("Client not found", { status: 404 });
  const [
    broker,
    emailTemplates,
    noteAuthors,
    reference,
    carWording,
    footerImage,
    emailDirectory,
  ] = await Promise.all([
    getAuthorisedRepresentative(client.authorisedRepresentativeId),
    listEmailTemplates(),
    resolveNoteAuthors((policy.notes ?? []).map((note) => note.createdBy)),
    getReferenceDataAsync(policy.dateStart),
    getCarWording(),
    getEmailFooterImage(),
    listEmailDirectory(),
  ]);

  return {
    policy,
    client,
    broker,
    emailTemplates,
    noteAuthors,
    reference,
    carWording,
    footerImageDataUri: footerImage.dataUri,
    footerImageWidth: footerImage.displayWidth,
    emailDirectory,
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
      const [deleted] = await deletePolicies([policyId]);
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
    const parsed = carPolicyPricingSchema.safeParse(payload);
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors };
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
    };
  }

  const parsed = carPolicySchema.safeParse(payload);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Full schema strips premium; re-attach manual override from the raw payload.
  const premiumOverride = parsePremiumOverride(payload);

  const before = await getPolicy(policyId);
  try {
    await upsertPolicyFromForm(
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

  if (
    before != null &&
    Number(before.policyStatusId) !== Number(parsed.data.policyStatusId)
  ) {
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
    return redirect(
      withSuccessToast(
        `/policies/${policyId}`,
        `Policy ${before?.policyNumber ?? policyId} status saved`,
      ),
    );
  }

  await writeAuditLog({
    actor,
    action: "policy.save",
    entityType: "policy",
    entityId: policyId,
    summary: `Saved policy ${before?.policyNumber ?? policyId}`,
    metadata: { policyNumber: before?.policyNumber },
    request,
  });

  return redirect(
    withSuccessToast(
      `/policies/${policyId}`,
      `Policy ${before?.policyNumber ?? policyId} saved`,
    ),
  );
}

export function shouldRevalidate({
  formData,
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formData?.get("intent") === "draft") return false;
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
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const readOnly = isTerminalStatus(loaderData.policy.policyStatusId);
  const canAdjust =
    loaderData.policy.policyStatusId === POLICY_STATUS.Taken &&
    Boolean(loaderData.policy.car.premium);
  const canClone = readOnly;
  const canDelete = !readOnly;
  const isCloning =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "clone";
  const isDeleting =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "delete";
  const wasCloned = searchParams.get("cloned") === "1";
  const isNew = searchParams.get("new") === "1";
  const clearedCloneForPolicyId = useRef<string | null>(null);
  const deleteError =
    actionData && "formError" in actionData ? actionData.formError : null;

  useEffect(() => {
    if (!wasCloned) return;
    if (clearedCloneForPolicyId.current === loaderData.policy.policyId) return;
    clearWizardStepState(loaderData.policy.policyId);
    clearedCloneForPolicyId.current = loaderData.policy.policyId;
  }, [wasCloned, loaderData.policy.policyId]);

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
          <Link to={`/policies/${loaderData.policy.policyId}/adjust`}>
            <Button size="sm">
              <SlidersHorizontalIcon data-icon="inline-start" />
              {loaderData.policy.car.adjusted ? "Re-adjust" : "Adjust"}
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
                  loadingLabel="Cloning…"
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
      <CarPolicyWizard
        key={`${loaderData.policy.policyId}-${wasCloned ? "cloned" : "view"}`}
        policy={loaderData.policy}
        reference={loaderData.reference}
        carWording={loaderData.carWording}
        readOnly={readOnly}
        freshSteps={wasCloned}
        isNew={isNew}
        clientName={loaderData.client.name}
        brokerName={loaderData.broker?.fullName ?? ""}
        brokerEmail={loaderData.broker?.email ?? ""}
        noteAuthors={loaderData.noteAuthors}
        emailTemplates={loaderData.emailTemplates}
        emailDirectory={loaderData.emailDirectory}
        emailTemplateVars={{
          coverType:
            loaderData.reference.coverTypes.find(
              (item) => item.coverTypeId === loaderData.policy.car.coverTypeId,
            )?.name ?? "",
          insuredName: loaderData.policy.car.insuredName,
          siteAddress: loaderData.policy.car.siteAddress,
          ...emailVarsFromAccountManager(
            loaderData.reference.accountManagers.find(
              (item) =>
                item.accountManagerId === loaderData.client.accountManagerId,
            ),
          ),
          footerImage: loaderData.footerImageDataUri,
        }}
        footerImageWidth={loaderData.footerImageWidth}
        headerActions={headerActions}
      />
      <DeletePoliciesDialog
        policies={[
          {
            policyId: loaderData.policy.policyId,
            policyNumber: loaderData.policy.policyNumber,
          },
        ]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        loading={isDeleting}
        error={deleteOpen ? deleteError : null}
        onBeforeSubmit={() => {
          clearWizardStepState(loaderData.policy.policyId);
          allowWizardLeave(loaderData.policy.policyId);
        }}
      />
    </div>
  );
}
