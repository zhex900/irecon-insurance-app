import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PageHeader } from "~/components/layout/app-layout";
import { formatCurrency, formatDate } from "~/lib/utils";
import {
  getClient,
  getReferenceData,
  listQuotes,
} from "~/lib/services/store";
import type { Route } from "./+types/clients.$clientId";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData.client.name} | CAR Broker Portal` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const clientId = Number(params.clientId);
  const client = await getClient(clientId);
  if (!client) throw new Response("Client not found", { status: 404 });

  return {
    client,
    quotes: await listQuotes(clientId),
    reference: getReferenceData(),
  };
}

export default function ClientDetailRoute({ loaderData }: Route.ComponentProps) {
  const entity = loaderData.reference.entityTypes.find(
    (item) => item.entityTypeId === loaderData.client.entityTypeId,
  );
  const manager = loaderData.reference.accountManagers.find(
    (item) => item.accountManagerId === loaderData.client.accountManagerId,
  );

  return (
    <div>
      <PageHeader
        title={loaderData.client.name}
        description={loaderData.client.tradingName}
        action={
          <Link to={`/quotes/new?clientId=${loaderData.client.clientId}`}>
            <Button>New CAR quote</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Client profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-slate-500">Entity type</p>
              <p className="font-medium">{entity?.name}</p>
            </div>
            <div>
              <p className="text-slate-500">Account manager</p>
              <p className="font-medium">{manager?.fullName}</p>
            </div>
            <div>
              <p className="text-slate-500">Created</p>
              <p className="font-medium">{formatDate(loaderData.client.createdWhen)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CAR quotes</CardTitle>
          </CardHeader>
          <CardContent>
            {loaderData.quotes.length === 0 ? (
              <p className="text-sm text-slate-500">No quotes yet for this client.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {loaderData.quotes.map((quote) => {
                  const status = loaderData.reference.carStatuses.find(
                    (item) => item.carStatusId === quote.carStatusId,
                  );
                  return (
                    <Link
                      key={quote.policyId}
                      to={`/quotes/${quote.policyId}`}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">{quote.policyNumber}</p>
                        <p className="text-sm text-slate-500">
                          Effective {formatDate(quote.dateEffective)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge>{status?.name}</Badge>
                        <span className="text-sm font-medium">
                          {quote.car.premium
                            ? formatCurrency(quote.car.premium.originalTotalPremium)
                            : "Draft"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
