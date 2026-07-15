import { redirect, Link } from "react-router";
import { CarAdjustmentWizard } from "~/components/forms/car-adjustment-wizard";
import { PageHeader } from "~/components/layout/app-layout";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  AdjustmentError,
  calculateAdjustmentForQuote,
  submitPolicyAdjustment,
} from "~/lib/services/adjustment.service";
import { CAR_STATUS } from "~/lib/zod/policy-car";
import { carAdjustmentInputSchema } from "~/lib/zod/policy-adjustment";
import { getClient, getQuote, getReferenceData } from "~/lib/services/store";
import type { Route } from "./+types/quotes.$policyId.adjust";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Adjust ${loaderData.quote.policyNumber} | CAR Broker Portal` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const policyId = Number(params.policyId);
  const quote = await getQuote(policyId);
  if (!quote) throw new Response("Quote not found", { status: 404 });

  if (quote.carStatusId !== CAR_STATUS.Taken) {
    throw new Response("You can only adjust a policy where the status is taken.", {
      status: 400,
    });
  }

  if (quote.car.adjusted) {
    throw new Response("This policy has already been adjusted.", { status: 400 });
  }

  if (!quote.car.premium || !quote.car.rating) {
    throw new Response("Premium must be calculated before adjusting this policy.", {
      status: 400,
    });
  }

  const client = await getClient(quote.clientId);
  if (!client) throw new Response("Client not found", { status: 404 });

  return {
    quote,
    client,
    reference: getReferenceData(),
  };
}

function parsePayload(raw: string) {
  return JSON.parse(raw) as unknown;
}

export async function action({ request, params }: Route.ActionArgs) {
  const policyId = Number(params.policyId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "calculate");
  const parsed = carAdjustmentInputSchema.safeParse(
    parsePayload(String(formData.get("payload") ?? "{}")),
  );

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const quote = await getQuote(policyId);
  if (!quote) {
    return { formError: "Quote not found." };
  }

  try {
    if (intent === "finish") {
      await submitPolicyAdjustment(policyId, parsed.data);
      return redirect(`/quotes/${policyId}?adjusted=1`);
    }

    const breakdown = calculateAdjustmentForQuote(quote, parsed.data);
    return { breakdown };
  } catch (error) {
    if (error instanceof AdjustmentError) {
      return { formError: error.message };
    }
    throw error;
  }
}

export default function QuoteAdjustRoute({ loaderData }: Route.ComponentProps) {
  const status = loaderData.reference.carStatuses.find(
    (item) => item.carStatusId === loaderData.quote.carStatusId,
  );

  return (
    <div>
      <PageHeader
        title={`Adjust ${loaderData.quote.policyNumber}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>End of term adjustment for {loaderData.client.name}</span>
            {status ? <Badge>{status.name}</Badge> : null}
          </span>
        }
        action={
          <Link to={`/quotes/${loaderData.quote.policyId}`}>
            <Button variant="outline">Back to policy</Button>
          </Link>
        }
      />
      <CarAdjustmentWizard quote={loaderData.quote} />
    </div>
  );
}
