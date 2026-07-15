import { redirect, Link, useSearchParams } from "react-router";
import { CarQuoteWizard } from "~/components/forms/car-quote-wizard";
import { AdjustmentPricingTables } from "~/components/forms/car-adjustment-wizard";
import { PageHeader } from "~/components/layout/app-layout";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { carQuoteDraftSchema, carQuotePricingSchema, carQuoteSchema } from "~/lib/zod/policy-car";
import type { CarQuoteFormValues } from "~/lib/zod/policy-car";
import { CAR_STATUS } from "~/lib/zod/policy-car";
import {
  applyPremiumCalculation,
  isTerminalStatus,
  PolicySaveError,
  saveQuoteDraft,
  upsertQuoteFromForm,
} from "~/lib/services/policy.service";
import { getCarWording, getClient, getQuote, getReferenceData } from "~/lib/services/store";
import type { Route } from "./+types/quotes.$policyId";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData.quote.policyNumber} | CAR Broker Portal` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const policyId = Number(params.policyId);
  const quote = await getQuote(policyId);
  if (!quote) throw new Response("Quote not found", { status: 404 });
  const client = await getClient(quote.clientId);
  if (!client) throw new Response("Client not found", { status: 404 });

  return {
    quote,
    client,
    reference: getReferenceData(),
    carWording: getCarWording(),
  };
}

function parsePayload(raw: string): CarQuoteFormValues {
  return JSON.parse(raw) as CarQuoteFormValues;
}

export async function action({ request, params }: Route.ActionArgs) {
  const policyId = Number(params.policyId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");
  const payload = parsePayload(String(formData.get("payload") ?? "{}"));

  if (intent === "draft") {
    const parsed = carQuoteDraftSchema.safeParse(payload);
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors };
    }
    try {
      await saveQuoteDraft(policyId, parsed.data);
    } catch (error) {
      if (error instanceof PolicySaveError) {
        return { formError: error.message };
      }
      throw error;
    }
    return { ok: true, savedAt: new Date().toISOString() };
  }

  if (intent === "recalculate" || intent === "calculate") {
    const parsed = carQuotePricingSchema.safeParse(payload);
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors };
    }
    const quote = await applyPremiumCalculation(policyId, parsed.data as CarQuoteFormValues);
    return {
      premium: quote.car.premium,
      referralReasons: quote.car.referralReasons,
      rating: quote.car.rating,
      notes: quote.notes,
    };
  }

  const parsed = carQuoteSchema.safeParse(payload);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await upsertQuoteFromForm(policyId, parsed.data);
  } catch (error) {
    if (error instanceof PolicySaveError) {
      return { formError: error.message };
    }
    throw error;
  }
  return redirect(`/quotes/${policyId}?saved=1`);
}

export default function QuoteDetailRoute({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const status = loaderData.reference.carStatuses.find(
    (item) => item.carStatusId === loaderData.quote.carStatusId,
  );
  const readOnly = isTerminalStatus(loaderData.quote.carStatusId);
  const canAdjust =
    loaderData.quote.carStatusId === CAR_STATUS.Taken &&
    !loaderData.quote.car.adjusted &&
    Boolean(loaderData.quote.car.premium);

  return (
    <div>
      <PageHeader
        title={loaderData.quote.policyNumber}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              CAR quote for {loaderData.client.name}
              {loaderData.quote.isDraft ? " (draft)" : ""}
            </span>
            {status ? <Badge>{status.name}</Badge> : null}
            {loaderData.quote.car.adjusted ? <Badge className="border-blue-200 bg-blue-50 text-blue-800">Adjusted</Badge> : null}
            {readOnly ? (
              <span className="text-slate-500">Status is final — editing disabled</span>
            ) : null}
          </span>
        }
        action={
          canAdjust ? (
            <Link to={`/quotes/${loaderData.quote.policyId}/adjust`}>
              <Button>Adjust</Button>
            </Link>
          ) : null
        }
      />
      {searchParams.get("adjusted") === "1" ? (
        <div className="mb-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Policy adjusted successfully.
        </div>
      ) : null}
      {loaderData.quote.car.adjusted && loaderData.quote.car.adjustment ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>End of Term Adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <AdjustmentPricingTables
              breakdown={loaderData.quote.car.adjustment.breakdown}
            />
          </CardContent>
        </Card>
      ) : null}
      <CarQuoteWizard
        quote={loaderData.quote}
        reference={loaderData.reference}
        carWording={loaderData.carWording}
        readOnly={readOnly}
      />
    </div>
  );
}
