import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { PageHeader } from "~/components/layout/app-layout";
import { getReferenceData, listClients } from "~/lib/services/store";
import type { Route } from "./+types/clients._index";

export function meta() {
  return [{ title: "Clients | CAR Broker Portal" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? "";
  return {
    clients: await listClients(search),
    reference: getReferenceData(),
    search,
  };
}

export default function ClientsIndexRoute({ loaderData }: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Select an existing client or create a new one."
        action={
          <Link to="/clients/new">
            <Button>New client</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form
            className="flex flex-col gap-3 md:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const q = String(formData.get("q") ?? "");
              setSearchParams(q ? { q } : {});
            }}
          >
            <input
              name="q"
              defaultValue={loaderData.search}
              placeholder="Search by legal or trading name"
              className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Legal name</th>
              <th className="px-4 py-3">Trading name</th>
              <th className="px-4 py-3">Entity type</th>
              <th className="px-4 py-3">Account manager</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loaderData.clients.map((client) => {
              const entity = loaderData.reference.entityTypes.find(
                (item) => item.entityTypeId === client.entityTypeId,
              );
              const manager = loaderData.reference.accountManagers.find(
                (item) => item.accountManagerId === client.accountManagerId,
              );
              return (
                <tr
                  key={client.clientId}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => navigate(`/clients/${client.clientId}`)}
                >
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3">{client.tradingName}</td>
                  <td className="px-4 py-3">{entity?.name}</td>
                  <td className="px-4 py-3">{manager?.fullName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
