import { ClientForm } from "~/components/clients/client-form";
import { PageHeader } from "~/components/layout/app-layout";
import { requireAuth } from "~/lib/auth/session.server";
import { booleanFlagSchema, parseUuid } from "~/lib/http/route-input";
import { clientNotFoundResponse } from "~/lib/http/resource-not-found";
import { pageTitle } from "~/lib/brand";
import { getClient } from "~/lib/services/clients/service";
import { getReferenceDataAsync } from "~/lib/services/reference.service";
import type { Route } from "./+types/$clientId.edit";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: pageTitle(
        loaderData.isNew ? "New client" : `Edit ${loaderData.client.name}`,
      ),
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const clientId = parseUuid(params.clientId);
  if (!clientId) throw clientNotFoundResponse();
  const isNew =
    booleanFlagSchema.parse(
      new URL(request.url).searchParams.get("new") ?? "0",
    ) === "1";
  const [client, reference] = await Promise.all([
    getClient(clientId),
    getReferenceDataAsync(),
  ]);
  if (!client) throw clientNotFoundResponse();
  return { client, reference, isNew };
}

export default function EditClientRoute({ loaderData }: Route.ComponentProps) {
  const clientLabel =
    loaderData.client.name || `Client #${loaderData.client.clientId}`;

  return (
    <div>
      <PageHeader
        title={loaderData.isNew ? "New client" : "Edit client"}
        breadcrumbs={
          loaderData.isNew
            ? [{ label: "Clients", to: "/clients" }, { label: "New client" }]
            : [
                { label: "Clients", to: "/clients" },
                {
                  label: clientLabel,
                  to: `/clients/${loaderData.client.clientId}`,
                },
                { label: "Edit" },
              ]
        }
      />
      <ClientForm
        client={loaderData.client}
        reference={loaderData.reference}
        isNew={loaderData.isNew}
        cancelTo={
          loaderData.isNew
            ? "/clients"
            : `/clients/${loaderData.client.clientId}`
        }
      />
    </div>
  );
}
