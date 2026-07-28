import { redirect } from "react-router";
import { CarAdjustmentWizard } from "~/components/forms/car-adjustment-wizard";
import { PageHeader } from "~/components/layout/app-layout";
import { Badge } from "~/components/reui/badge";
import { withSuccessToast } from "~/hooks/use-success-toast";
import { requireAuth } from "~/lib/auth/session.server";
import {
  AdjustmentError,
  calculateAdjustmentForPolicy,
  submitPolicyAdjustment,
} from "~/lib/services/policy/adjustment.service";
import { writeAuditLog } from "~/lib/services/audit/service";
import { POLICY_STATUS } from "~/lib/zod/policy-car";
import { carAdjustmentInputSchema } from "~/lib/zod/policy-adjustment";
import { getClient } from "~/lib/services/clients/service";
import { getPolicy } from "~/lib/services/policy/data.service";
import { getReferenceData } from "~/lib/services/reference.service";
import type { Route } from "./+types/$policyId.adjust";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Adjust ${loaderData.policy.policyNumber} | BrokerSure` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const policyId = Number(params.policyId);
  const policy = await getPolicy(policyId);
  if (!policy) throw new Response("Policy not found", { status: 404 });

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
  if (!client) throw new Response("Client not found", { status: 404 });

  return {
    policy,
    client,
    reference: getReferenceData(),
  };
}

function parsePayload(raw: string) {
  return JSON.parse(raw) as unknown;
}

export async function action({ request, params }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const policyId = Number(params.policyId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "calculate");
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
      await submitPolicyAdjustment(policyId, parsed.data);
      await writeAuditLog({
        actor,
        action: "policy.adjust",
        entityType: "policy",
        entityId: policyId,
        summary: `Applied adjustment on ${policy.policyNumber}`,
        metadata: {
          policyNumber: policy.policyNumber,
          adjustmentTurnover: parsed.data.adjustmentTurnover,
        },
        request,
      });
      return redirect(
        withSuccessToast(
          `/policies/${policyId}`,
          `Adjustment saved on ${policy.policyNumber}`,
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
        title={`Adjust ${loaderData.policy.policyNumber}`}
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
            label: loaderData.policy.policyNumber,
            to: `/policies/${loaderData.policy.policyId}`,
          },
          { label: "Adjust" },
        ]}
      />
      <CarAdjustmentWizard policy={loaderData.policy} />
    </div>
  );
}
