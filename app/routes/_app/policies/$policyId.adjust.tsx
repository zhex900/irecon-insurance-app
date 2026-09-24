import { redirect } from "react-router";

import { PageHeader } from "~/components/layout/app-layout";
import { CarAdjustmentWizard } from "~/components/policies/car-adjustment-wizard";
import { Badge } from "~/components/reui/badge";
import { withSuccessToast } from "~/hooks/utilities";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import {
  getLibraryDocumentsBucket,
  getPdfService,
} from "~/lib/cloudflare.server";
import {
  clientNotFoundResponse,
  policyNotFoundResponse,
} from "~/lib/http/resource-not-found";
import { parseFormIntent, parseUuid } from "~/lib/http/route-input";
import { policyDisplayNumber } from "~/lib/policies/policy-display";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getClient } from "~/lib/services/clients/service";
import {
  AdjustmentError,
  calculateAdjustmentForPolicy,
  submitPolicyAdjustment,
} from "~/lib/services/policy/adjustment.service";
import { getPolicy } from "~/lib/services/policy/data.service";
import { getReferenceData } from "~/lib/services/reference.service";
import { carAdjustmentInputSchema } from "~/lib/zod/policy-adjustment";
import { POLICY_STATUS } from "~/lib/zod/policy-car";

import type { Route } from "./+types/$policyId.adjust";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: pageTitle(`Adjust ${policyDisplayNumber(loaderData.policy)}`) }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) throw policyNotFoundResponse();
  const policy = await getPolicy(policyId);
  if (!policy) throw policyNotFoundResponse();

  if (policy.policyStatusId !== POLICY_STATUS.Taken) {
    throw new Response(
      "You can only adjust a policy where the status is taken.",
      {
        status: 400,
      },
    );
  }

  if (!policy.car.premium || !policy.car.rating) {
    throw new Response(
      "Premium must be calculated before adjusting this policy.",
      {
        status: 400,
      },
    );
  }

  const client = await getClient(policy.clientId);
  if (!client) throw clientNotFoundResponse();

  return {
    policy,
    client,
    reference: getReferenceData(),
  };
}

function parsePayload(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) return { formError: "Invalid policy id." };
  const formData = await request.formData();
  const intent = parseFormIntent(
    formData,
    ["calculate", "finish"],
    "calculate",
  );
  if (!intent) return { formError: "Unknown action." };
  const parsed = carAdjustmentInputSchema.safeParse(
    parsePayload(String(formData.get("payload") ?? "{}")),
  );

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const policy = await getPolicy(policyId);
  if (!policy) {
    return { formError: "Policy not found." };
  }

  try {
    if (intent === "finish") {
      await submitPolicyAdjustment(policyId, parsed.data, actor.email, {
        libraryBucket: getLibraryDocumentsBucket(context),
        pdfService: getPdfService(context),
      });
      await writeAuditLog({
        actor,
        action: "policy.adjust",
        entityType: "policy",
        entityId: policyId,
        summary: `Applied adjustment on ${policyDisplayNumber(policy)}`,
        metadata: {
          policyNumber: policyDisplayNumber(policy),
          adjustmentTurnover: parsed.data.adjustmentTurnover,
        },
        request,
      });
      return redirect(
        withSuccessToast(
          `/policies/${policyId}`,
          `Adjustment saved on ${policyDisplayNumber(policy)}`,
        ),
      );
    }

    const breakdown = calculateAdjustmentForPolicy(policy, parsed.data);
    return { breakdown };
  } catch (error) {
    if (error instanceof AdjustmentError) {
      return { formError: error.message };
    }
    throw error;
  }
}

export default function PolicyAdjustRoute({
  loaderData,
}: Route.ComponentProps) {
  const status = loaderData.reference.policyStatuses.find(
    (item) => item.policyStatusId === loaderData.policy.policyStatusId,
  );

  return (
    <div>
      <PageHeader
        title={`Adjust ${policyDisplayNumber(loaderData.policy)}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>End of term adjustment for {loaderData.client.name}</span>
            {status ? <Badge>{status.name}</Badge> : null}
          </span>
        }
        breadcrumbs={[
          { label: "Clients", to: "/clients" },
          {
            label: loaderData.client.name || "Client",
            to: `/clients/${loaderData.client.clientId}`,
          },
          {
            label: policyDisplayNumber(loaderData.policy),
            to: `/policies/${loaderData.policy.policyId}`,
          },
          { label: "Adjust" },
        ]}
      />
      <CarAdjustmentWizard policy={loaderData.policy} />
    </div>
  );
}
