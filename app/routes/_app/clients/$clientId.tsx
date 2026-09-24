import { useState } from "react";
import { Form, redirect, useActionData, useNavigation } from "react-router";

import { ClientPolicies } from "~/components/clients/summary";
import { PageHeader } from "~/components/layout/app-layout";
import { AppLink } from "~/components/navigation/app-link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { LoadingButton } from "~/components/ui/loading-button";
import { withSuccessToast } from "~/hooks/utilities";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { clientNotFoundResponse } from "~/lib/http/resource-not-found";
import { parseFormIntent, parseUuid } from "~/lib/http/route-input";
import { parsePagination } from "~/lib/pagination";
import { parsePolicyListFiltersFromUrl } from "~/lib/search/policy-list-filters";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  countClientPolicies,
  deleteClient,
  getClient,
} from "~/lib/services/clients/service";
import { markRecentEntityRemoved } from "~/lib/services/navigation/recent-routes";
import { listPoliciesPage } from "~/lib/services/policies/list.service";
import { deletePolicies } from "~/lib/services/policy/data.service";
import { getReferenceDataAsync } from "~/lib/services/reference.service";
import { formatCurrency, formatDate } from "~/lib/utils";

import type { Route } from "./+types/$clientId";

const PAGE_SIZE = 25;

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: pageTitle(`${loaderData.client.name}`) }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuth(request);
  const clientId = parseUuid(params.clientId);
  if (!clientId) throw clientNotFoundResponse();
  const url = new URL(request.url);
  const filters = parsePolicyListFiltersFromUrl(url);
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });

  const [client, reference, page] = await Promise.all([
    getClient(clientId),
    getReferenceDataAsync(),
    listPoliciesPage(
      {
        clientIds: [clientId],
        search: filters.q,
        policyStatusIds: filters.statusIds,
        coverTypeIds: filters.coverTypeIds,
        policyCategoryIds: filters.policyCategoryIds,
        inceptionFrom: filters.inception.from,
        inceptionTo: filters.inception.to,
        expiryFrom: filters.expiry.from,
        expiryTo: filters.expiry.to,
        limit: pagination.limit,
        offset: pagination.offset,
      },
      { includePremium: true, includeMeta: true },
    ),
  ]);
  if (!client) throw clientNotFoundResponse();

  // After the heavy list query batch — avoids query-gate contention with meta counts.
  const policyCount = await countClientPolicies(clientId);

  const allCount = Object.values(page.statusCounts).reduce((a, b) => a + b, 0);

  return {
    client,
    policies: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    statusCounts: page.statusCounts,
    coverCounts: page.coverCounts,
    categoryCounts: page.categoryCounts,
    inceptionPresetCounts: page.inceptionPresetCounts,
    expiryPresetCounts: page.expiryPresetCounts,
    allCount,
    policyCount,
    totalBasePremiumExGst: page.totalBasePremiumExGst,
    totalBrokerFeeExGst: page.totalBrokerFeeExGst,
    q: filters.q,
    filters: {
      statusIds: filters.statusIds,
      coverTypeIds: filters.coverTypeIds,
      policyCategoryIds: filters.policyCategoryIds,
      inception: filters.inception,
      expiry: filters.expiry,
    },
    reference,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const clientId = parseUuid(params.clientId);
  if (!clientId) return { ok: false as const, error: "Invalid client id" };
  const formData = await request.formData();
  const intent = parseFormIntent(formData, ["delete", "delete-policies"]);

  if (intent === "delete-policies") {
    const ids = formData
      .getAll("ids")
      .map((value) => parseUuid(value))
      .filter((id) => id != null);

    if (ids.length === 0) {
      return { ok: false as const, error: "No policies selected" };
    }

    try {
      const deleted = await deletePolicies(ids, {
        clientId,
        userId: actor.userId,
      });
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
        error: publicErrorMessage(error, {
          fallback: "Delete failed",
          operation: "client_policy_delete",
        }),
      };
    }
  }

  if (intent !== "delete") {
    return { ok: false as const, error: "Unknown action" };
  }

  try {
    const deleted = await deleteClient(clientId, { userId: actor.userId });
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
      error: publicErrorMessage(error, {
        fallback: "Delete failed",
        operation: "client_delete",
      }),
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
            <AppLink to={`/clients/${client.clientId}/edit`}>
              <Button type="button" variant="outline">
                Edit Client
              </Button>
            </AppLink>
            {policyCount === 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            ) : null}
            <Form
              method="post"
              action={`/policies/new?clientId=${client.clientId}`}
            >
              <Button type="submit">+ New Policy</Button>
            </Form>
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
            <div className="flex justify-between text-sm lg:items-end">
              <CardTitle>Policies</CardTitle>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>
                  Base Premium (Ex. GST):{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(loaderData.totalBasePremiumExGst)}
                  </span>
                </span>
                <span>
                  Broker Fee (Ex. GST):{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(loaderData.totalBrokerFeeExGst)}
                  </span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ClientPolicies
              policies={loaderData.policies}
              total={loaderData.total}
              page={loaderData.page}
              pageSize={loaderData.pageSize}
              statusCounts={loaderData.statusCounts}
              coverCounts={loaderData.coverCounts}
              categoryCounts={loaderData.categoryCounts}
              inceptionPresetCounts={loaderData.inceptionPresetCounts}
              expiryPresetCounts={loaderData.expiryPresetCounts}
              allCount={loaderData.allCount}
              policyCount={loaderData.policyCount}
              q={loaderData.q}
              filters={loaderData.filters}
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
            <Form
              method="post"
              onSubmit={() => {
                markRecentEntityRemoved({
                  kind: "client",
                  id: client.clientId,
                });
              }}
            >
              <input type="hidden" name="intent" value="delete" />
              <LoadingButton
                type="submit"
                variant="destructive"
                loading={deleting}
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
