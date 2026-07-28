import { useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { ClientPoliciesTable } from "~/components/clients/client-policies-table";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { PageHeader } from "~/components/layout/app-layout";
import { withSuccessToast } from "~/hooks/use-success-toast";
import { requireAuth } from "~/lib/auth/session.server";
import { parsePagination } from "~/lib/pagination";
import { formatDate } from "~/lib/utils";
import { writeAuditLog } from "~/lib/services/audit/service";
import { listPoliciesPage } from "~/lib/services/policies/list.service";
import {
  countClientPolicies,
  deleteClient,
  getClient,
} from "~/lib/services/clients/service";
import { deletePolicies } from "~/lib/services/policy/data.service";
import { getReferenceDataAsync } from "~/lib/services/reference.service";
import type { Route } from "./+types/$clientId";

const PAGE_SIZE = 25;

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData.client.name} | BrokerSure` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const clientId = Number(params.clientId);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const statusParam = url.searchParams.get("status");
  const statusFilter = statusParam ? Number(statusParam) : null;
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });

  const [client, reference, page, policyCount] = await Promise.all([
    getClient(clientId),
    getReferenceDataAsync(),
    listPoliciesPage({
      clientId,
      search: q,
      policyStatusId:
        statusFilter && !Number.isNaN(statusFilter) ? statusFilter : null,
      limit: pagination.limit,
      offset: pagination.offset,
    }),
    countClientPolicies(clientId),
  ]);
  if (!client) throw new Response("Client not found", { status: 404 });

  const allCount = Object.values(page.statusCounts).reduce((a, b) => a + b, 0);

  return {
    client,
    policies: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    statusCounts: page.statusCounts,
    allCount,
    policyCount,
    q,
    statusFilter:
      statusFilter && !Number.isNaN(statusFilter) ? statusFilter : null,
    reference,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const clientId = Number(params.clientId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "delete-policies") {
    const ids = formData
      .getAll("ids")
      .map((value) => Number(value))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
      return { ok: false as const, error: "No policies selected" };
    }

    try {
      const deleted = await deletePolicies(ids, { clientId });
      await writeAuditLog({
        actor,
        action: "policy.delete",
        entityType: "policy",
        entityId: deleted.length === 1 ? deleted[0].policyId : undefined,
        summary:
          deleted.length === 1
            ? `Deleted policy ${deleted[0].policyNumber}`
            : `Deleted ${deleted.length} policies`,
        metadata: {
          clientId,
          policyIds: deleted.map((row) => row.policyId),
          policyNumbers: deleted.map((row) => row.policyNumber),
        },
        request,
      });
      return {
        ok: true as const,
        intent: "delete-policies" as const,
        count: deleted.length,
        message:
          deleted.length === 1
            ? `Policy ${deleted[0].policyNumber} deleted`
            : `${deleted.length} policies deleted`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Delete failed",
      };
    }
  }

  if (intent !== "delete") {
    return { ok: false as const, error: "Unknown action" };
  }

  try {
    const deleted = await deleteClient(clientId);
    await writeAuditLog({
      actor,
      action: "client.delete",
      entityType: "client",
      entityId: clientId,
      summary: `Deleted client ${deleted.name}`,
      metadata: {
        name: deleted.name,
        tradingName: deleted.tradingName,
        email: deleted.email,
      },
      request,
    });
    return redirect(
      withSuccessToast("/clients", `Client ${deleted.name} deleted`),
    );
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export default function ClientDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const { client, reference, policyCount } = loaderData;
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const manager = reference.accountManagers.find(
    (item) => item.accountManagerId === client.accountManagerId,
  );
  const wholesale = reference.wholesaleBrokers.find(
    (item) =>
      item.authorisedRepresentativeId === client.authorisedRepresentativeId,
  );
  const initials = client.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const deleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  return (
    <div>
      <PageHeader
        title="Client Profile"
        description="Review client details and CAR policies."
        breadcrumbs={[
          { label: "Clients", to: "/clients" },
          { label: client.name || `Client #${client.clientId}` },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to={`/clients/${client.clientId}/edit`}>
              <Button type="button" variant="outline">
                Edit Client
              </Button>
            </Link>
            {policyCount === 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            ) : null}
            <Link to={`/policies/new?clientId=${client.clientId}`}>
              <Button>+ New Policy</Button>
            </Link>
          </div>
        }
      />

      {actionData && !actionData.ok && actionData.error ? (
        <p className="mb-3 text-sm text-destructive">{actionData.error}</p>
      ) : null}

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-foreground">
                  {client.name}
                </h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {client.tradingName}
              </p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="ABN" value={client.abn} />
                <Detail label="Phone" value={client.phone} />
                <Detail label="Email" value={client.email} />
                <Detail label="Account manager" value={manager?.fullName} />
                <Detail
                  label="Created"
                  value={formatDate(client.createdWhen)}
                />
              </div>

              <div className="mt-6 border-t pt-4">
                <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Authorised Representative
                </p>
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="AR Contact Name" value={wholesale?.fullName} />
                  <Detail
                    label="AR Company Name"
                    value={wholesale?.companyName}
                  />
                  <Detail label="AR Number" value={wholesale?.arNumber} />
                  <Detail label="AR Email" value={wholesale?.email} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policies Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientPoliciesTable
              policies={loaderData.policies}
              total={loaderData.total}
              page={loaderData.page}
              pageSize={loaderData.pageSize}
              statusCounts={loaderData.statusCounts}
              allCount={loaderData.allCount}
              q={loaderData.q}
              statusFilter={loaderData.statusFilter}
              reference={loaderData.reference}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete client?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">{client.name}</span>
              . This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <LoadingButton
                type="submit"
                variant="destructive"
                loading={deleting}
                loadingLabel="Deleting…"
              >
                Delete
              </LoadingButton>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
