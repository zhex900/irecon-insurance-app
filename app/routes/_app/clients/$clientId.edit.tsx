import { ClientForm } from "~/components/clients/client-form";
import { PageHeader } from "~/components/layout/app-layout";
import { getClient } from "~/lib/services/clients/service";
import { getReferenceDataAsync } from "~/lib/services/reference.service";
import type { Route } from "./+types/$clientId.edit";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData.isNew ? "New client" : `Edit ${loaderData.client.name}`} | BrokerSure`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const clientId = Number(params.clientId);
  const isNew = new URL(request.url).searchParams.get("new") === "1";
  const [client, reference] = await Promise.all([
    getClient(clientId),
    getReferenceDataAsync(),
  ]);
  if (!client) throw new Response("Client not found", { status: 404 });
  return { client, reference, isNew };
}

export default function EditClientRoute({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageHeader title={loaderData.isNew ? "New client" : "Edit client"} />
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
