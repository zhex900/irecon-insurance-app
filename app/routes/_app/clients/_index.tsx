import { useMemo, useState } from "react";
import {
  Form,
  type ShouldRevalidateFunctionArgs,
  useActionData,
  useNavigation,
} from "react-router";

import { DeleteClientDialog } from "~/components/clients/dialogs";
import { ClientsTable,ClientsTableFilters } from "~/components/clients/list";
import { PageHeader } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { useListReference } from "~/hooks/list";
import { useDebouncedSearchQuery } from "~/hooks/search";
import { useActionSuccessToast,useHandledActionData  } from "~/hooks/utilities";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseFormIntent, parseUuid } from "~/lib/http/route-input";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  type ClientListItem,
  listClientsPage,
} from "~/lib/services/clients/list.service";
import { deleteClient } from "~/lib/services/clients/service";
import { referenceData } from "~/lib/reference-data";

import type { Route } from "./+types/_index";

const PAGE_SIZE = 25;

export function meta() {
  return [{ title: pageTitle("Clients") }];
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

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? "";
  const accountManagerId = parsePositiveInt(
    url.searchParams.get("accountManager"),
  );
  const authorisedRepresentativeId = parsePositiveInt(
    url.searchParams.get("ar"),
  );
  const arCompanyName = url.searchParams.get("arCompany")?.trim() ?? "";
  const policyFilterParam = url.searchParams.get("policies");
  const policyFilter: "all" | "with" | "without" =
    policyFilterParam === "with" || policyFilterParam === "without"
      ? policyFilterParam
      : "all";
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });

  const page = await listClientsPage({
    search,
    accountManagerId,
    authorisedRepresentativeId,
    arCompanyName: arCompanyName || null,
    policyFilter,
    limit: pagination.limit,
    offset: pagination.offset,
  });

  return {
    clients: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    withPolicies: page.withPolicies,
    withoutPolicies: page.withoutPolicies,
    allMatching: page.withPolicies + page.withoutPolicies,
    filters: {
      search,
      accountManagerId,
      authorisedRepresentativeId,
      arCompanyName,
      policyFilter,
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

  const id = parseUuid(formData.get("id"));
  if (!id) return { ok: false as const, error: "Missing id" };

  try {
    const deleted = await deleteClient(id);
    await writeAuditLog({
      actor,
      action: "client.delete",
      entityType: "client",
      entityId: id,
      summary: `Deleted client ${deleted.name}`,
      metadata: {
        name: deleted.name,
        tradingName: deleted.tradingName,
        email: deleted.email,
      },
      request,
    });
    return {
      ok: true as const,
      intent: "delete" as const,
      message: `Client ${deleted.name} deleted`,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: publicErrorMessage(error, {
        fallback: "Delete failed",
        operation: "client_bulk_delete",
      }),
    };
  }
}

export default function ClientsIndexRoute({
  loaderData,
}: Route.ComponentProps) {
  const {
    search,
    setSearch,
    clearSearch,
    searchQuery,
    searchParams,
    setSearchParams,
  } = useDebouncedSearchQuery(loaderData.filters.search);
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [deleting, setDeleting] = useState<ClientListItem | null>(null);
  useActionSuccessToast(actionData);

  useHandledActionData(actionData, {
    waitForIdle: false,
    intents: "delete",
    onSuccess: () => setDeleting(null),
  });

  const { reference: listReference } = useListReference();

  const reference = useMemo(() => {
    if (!listReference) return referenceData;
    return {
      ...referenceData,
      accountManagers: listReference.accountManagers,
      wholesaleBrokers: listReference.wholesaleBrokers,
    };
  }, [listReference]);

  const accountManagerOptions = useMemo(
    () =>
      reference.accountManagers.map((manager) => ({
        value: manager.accountManagerId,
        label: manager.fullName,
        secondary: manager.abbrev,
      })),
    [reference.accountManagers],
  );

  const arNameOptions = useMemo(
    () =>
      reference.wholesaleBrokers.map((ar) => ({
        value: ar.authorisedRepresentativeId,
        label: ar.fullName,
        secondary: ar.companyName,
        searchText: `${ar.companyName} ${ar.arNumber}`,
      })),
    [reference.wholesaleBrokers],
  );

  const arCompanyOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const ar of reference.wholesaleBrokers) {
      const company = ar.companyName.trim();
      if (!company) continue;
      const key = company.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ value: company, label: company });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [reference.wholesaleBrokers]);

  function buildParams(next?: {
    search?: string;
    accountManagerId?: number | null;
    authorisedRepresentativeId?: number | null;
    arCompanyName?: string;
    policyFilter?: "all" | "with" | "without";
    page?: number;
  }) {
    const q = (next?.search ?? search).trim();
    const manager =
      next?.accountManagerId !== undefined
        ? next.accountManagerId
        : loaderData.filters.accountManagerId;
    const ar =
      next?.authorisedRepresentativeId !== undefined
        ? next.authorisedRepresentativeId
        : loaderData.filters.authorisedRepresentativeId;
    const company = (
      next?.arCompanyName ?? loaderData.filters.arCompanyName
    ).trim();
    const policyFilter = next?.policyFilter ?? loaderData.filters.policyFilter;
    const page = next?.page ?? 1;

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (manager != null) params.set("accountManager", String(manager));
    if (ar != null) params.set("ar", String(ar));
    if (company) params.set("arCompany", company);
    if (policyFilter !== "all") params.set("policies", policyFilter);
    if (page > 1) params.set("page", String(page));
    return params;
  }

  function applyFilters(next?: Parameters<typeof buildParams>[0]) {
    setSearchParams(buildParams(next));
  }

  function clearFilters() {
    setSearch("");
    setSearchParams({});
  }

  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(loaderData.filters.accountManagerId) ||
    Boolean(loaderData.filters.authorisedRepresentativeId) ||
    Boolean(loaderData.filters.arCompanyName);

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE);

  const deletingInFlight =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  return (
    <div>
      <PageHeader
        title="Clients Directory"
        description="Manage and review all client records."
        breadcrumbs={[{ label: "Clients" }]}
        action={
          <Form method="post" action="/clients/new">
            <Button type="submit">+ New Client</Button>
          </Form>
        }
      />

      <ClientsTableFilters
        search={search}
        onSearchChange={setSearch}
        onSearchClear={clearSearch}
        accountManagerId={loaderData.filters.accountManagerId}
        authorisedRepresentativeId={
          loaderData.filters.authorisedRepresentativeId
        }
        arCompanyName={loaderData.filters.arCompanyName}
        policyFilter={loaderData.filters.policyFilter}
        accountManagerOptions={accountManagerOptions}
        arCompanyOptions={arCompanyOptions}
        arNameOptions={arNameOptions}
        total={loaderData.total}
        withPolicies={loaderData.withPolicies}
        withoutPolicies={loaderData.withoutPolicies}
        allMatching={loaderData.allMatching}
        hasActiveFilters={hasActiveFilters}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
      />

      {actionData && !actionData.ok && actionData.error ? (
        <p className="mb-3 text-sm text-destructive">{actionData.error}</p>
      ) : null}

      <ClientsTable
        clients={loaderData.clients}
        total={loaderData.total}
        page={loaderData.page}
        pageSize={loaderData.pageSize}
        searchQuery={searchQuery}
        searchFilter={loaderData.filters.search}
        reference={reference}
        pageHref={pageHref}
        pageSizeHref={pageSizeHref}
        onDeleteRequest={setDeleting}
      />

      <DeleteClientDialog
        client={deleting}
        deletingInFlight={deletingInFlight}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}
