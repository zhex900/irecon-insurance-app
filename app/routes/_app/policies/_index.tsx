import { useMemo } from "react";
import {
  type ShouldRevalidateFunctionArgs,
  useActionData,
} from "react-router";

import { ListSearchField } from "~/components/forms/list-search-field";
import { PageHeader } from "~/components/layout/app-layout";
import { NewPolicyClientDialog } from "~/components/policies/new-policy-client-dialog";
import { PolicyListTable } from "~/components/policies/policy-list-table";
import {
  usePolicyListPage,
  usePolicyListSecondary,
} from "~/hooks/policy-list";
import { useActionSuccessToast } from "~/hooks/utilities";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseFormIntent, parseUuid } from "~/lib/http/route-input";
import { parsePagination } from "~/lib/pagination";
import { referenceData } from "~/lib/reference-data";
import { parsePolicyListFiltersFromUrl } from "~/lib/search/policy-list-filters";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getClientsByIds } from "~/lib/services/clients/service";
import { listPoliciesPageCore } from "~/lib/services/policies/list.service";
import { deletePolicies } from "~/lib/services/policy/data.service";

import type { Route } from "./+types/_index";

const PAGE_SIZE = 25;

export function meta() {
  return [{ title: pageTitle("Policies") }];
}

export function shouldRevalidate({
  formData,
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formData?.get("intent") === "delete") return true;
  if (
    actionResult &&
    typeof actionResult === "object" &&
    "intent" in actionResult &&
    (actionResult as { intent?: string }).intent === "delete"
  ) {
    return true;
  }
  return defaultShouldRevalidate;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const filters = parsePolicyListFiltersFromUrl(url);
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });

  const [page, selectedClients] = await Promise.all([
    listPoliciesPageCore({
      search: filters.q,
      policyStatusIds: filters.statusIds,
      coverTypeIds: filters.coverTypeIds,
      policyCategoryIds: filters.policyCategoryIds,
      clientIds: filters.clientIds,
      inceptionFrom: filters.inception.from,
      inceptionTo: filters.inception.to,
      expiryFrom: filters.expiry.from,
      expiryTo: filters.expiry.to,
      limit: pagination.limit,
      offset: pagination.offset,
    }),
    getClientsByIds(filters.clientIds),
  ]);

  return {
    policies: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    q: filters.q,
    filters: {
      statusIds: filters.statusIds,
      coverTypeIds: filters.coverTypeIds,
      policyCategoryIds: filters.policyCategoryIds,
      clientIds: filters.clientIds,
      clients: selectedClients.map((client) => ({
        clientId: client.clientId,
        name: client.name,
        tradingName: client.tradingName,
      })),
      inception: filters.inception,
      expiry: filters.expiry,
    },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const formData = await request.formData();
  const intent = parseFormIntent(formData, ["delete"]);

  if (intent !== "delete") {
    return { ok: false as const, error: "Unknown action" };
  }

  const ids = formData
    .getAll("ids")
    .map((value) => parseUuid(value))
    .filter((id) => id != null);

  if (ids.length === 0) {
    return { ok: false as const, error: "No policies selected" };
  }

  try {
    const deleted = await deletePolicies(ids, { userId: actor.userId });
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
        policyIds: deleted.map((row) => row.policyId),
        policyNumbers: deleted.map((row) => row.policyNumber),
      },
      request,
    });
    return {
      ok: true as const,
      intent: "delete" as const,
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
        operation: "policy_bulk_delete",
      }),
    };
  }
}

export default function PoliciesIndexRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  useActionSuccessToast(actionData);

  const {
    search,
    setSearch,
    clearSearch,
    searchQuery,
    searchParams,
    setSearchParams,
    selection,
  } = usePolicyListPage({
    q: loaderData.q,
    filters: loaderData.filters,
    policies: loaderData.policies,
    page: loaderData.page,
    deleteIntent: "delete",
  });

  const {
    statusCounts,
    coverCounts,
    categoryCounts,
    inceptionPresetCounts,
    expiryPresetCounts,
    allCount,
    countsPending,
    reference: listReference,
  } = usePolicyListSecondary(searchParams);

  const reference = useMemo(() => {
    if (!listReference) return referenceData;
    return {
      ...referenceData,
      accountManagers: listReference.accountManagers,
      wholesaleBrokers: listReference.wholesaleBrokers,
    };
  }, [listReference]);

  const totalSummary =
    allCount != null
      ? `${loaderData.total} of ${allCount} policies`
      : countsPending
        ? `${loaderData.total} policies`
        : `${loaderData.total} policies`;

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Browse and open CAR policies."
        breadcrumbs={[{ label: "Policies" }]}
        action={<NewPolicyClientDialog />}
      />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <ListSearchField
          value={search}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Search policy #, insured, client…"
          aria-label="Search policies"
        />
        <p className="text-sm text-muted-foreground">{totalSummary}</p>
      </div>

      {actionData &&
      !actionData.ok &&
      actionData.error &&
      !selection.pendingDelete ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {actionData.error}
        </p>
      ) : null}

      <PolicyListTable
        policies={loaderData.policies}
        total={loaderData.total}
        page={loaderData.page}
        pageSize={loaderData.pageSize}
        statusCounts={statusCounts}
        coverCounts={coverCounts}
        categoryCounts={categoryCounts}
        inceptionPresetCounts={inceptionPresetCounts}
        expiryPresetCounts={expiryPresetCounts}
        countsPending={countsPending}
        q={loaderData.q}
        searchQuery={searchQuery}
        filters={loaderData.filters}
        reference={reference}
        selection={selection}
        search={search}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        defaultPageSize={PAGE_SIZE}
        deleteIntent="delete"
        showClientColumn
        clientFilter={{
          selected: loaderData.filters.clientIds,
          selectedOptions: loaderData.filters.clients,
          countQuery: searchParams.toString(),
        }}
      />
    </div>
  );
}
