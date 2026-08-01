import {
  Form,
  Link,
  useActionData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2Icon, UsersIcon, XIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FilterTag } from "~/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TablePagination } from "~/components/ui/table-pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { PageHeader } from "~/components/layout/app-layout";
import { FilterAutocomplete } from "~/components/clients/filter-autocomplete";
import { useActionSuccessToast } from "~/hooks/use-success-toast";
import { requireAuth } from "~/lib/auth/session.server";
import { HighlightText } from "~/lib/search/highlight";
import { fieldMatches } from "~/lib/search/match";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { cn, formatDate } from "~/lib/utils";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  listClientsPage,
  type ClientListItem,
} from "~/lib/services/clients/list.service";
import { deleteClient } from "~/lib/services/clients/service";
import { getReferenceDataAsync } from "~/lib/services/reference.service";
import type { Route } from "./+types/_index";
import { pageTitle } from "~/lib/brand";

const PAGE_SIZE = 25;

export function meta() {
  return [{ title: pageTitle("Clients") }];
}

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function loader({ request }: Route.LoaderArgs) {
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
  const policyFilter =
    policyFilterParam === "with" || policyFilterParam === "without"
      ? policyFilterParam
      : "all";
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });

  const [page, reference] = await Promise.all([
    listClientsPage({
      search,
      accountManagerId,
      authorisedRepresentativeId,
      arCompanyName: arCompanyName || null,
      policyFilter,
      limit: pagination.limit,
      offset: pagination.offset,
    }),
    getReferenceDataAsync(),
  ]);

  return {
    clients: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    withPolicies: page.withPolicies,
    withoutPolicies: page.withoutPolicies,
    allMatching: page.withPolicies + page.withoutPolicies,
    reference,
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
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "delete") {
    return { ok: false as const, error: "Unknown action" };
  }

  const id = Number(formData.get("id"));
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
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

export default function ClientsIndexRoute({
  loaderData,
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [search, setSearch] = useState(loaderData.filters.search);
  const [accountManagerId, setAccountManagerId] = useState<number | "">(
    loaderData.filters.accountManagerId ?? "",
  );
  const [authorisedRepresentativeId, setAuthorisedRepresentativeId] = useState<
    number | ""
  >(loaderData.filters.authorisedRepresentativeId ?? "");
  const [arCompanyName, setArCompanyName] = useState(
    loaderData.filters.arCompanyName,
  );
  const [deleting, setDeleting] = useState<ClientListItem | null>(null);
  useActionSuccessToast(actionData);

  const lastFiltersRef = useRef(loaderData.filters);
  useEffect(() => {
    if (lastFiltersRef.current === loaderData.filters) return;
    lastFiltersRef.current = loaderData.filters;
    const filters = lastFiltersRef.current;
    setSearch(filters.search);
    setAccountManagerId(filters.accountManagerId ?? "");
    setAuthorisedRepresentativeId(filters.authorisedRepresentativeId ?? "");
    setArCompanyName(filters.arCompanyName);
  }, [loaderData.filters]);

  const handledActionDataRef = useRef(actionData);
  useEffect(() => {
    if (handledActionDataRef.current === actionData) return;
    handledActionDataRef.current = actionData;
    const handled = handledActionDataRef.current;
    if (!handled?.ok || handled.intent !== "delete") return;
    setDeleting(null);
  }, [actionData]);

  const accountManagerOptions = useMemo(
    () =>
      loaderData.reference.accountManagers.map((manager) => ({
        value: manager.accountManagerId,
        label: manager.fullName,
        secondary: manager.abbrev,
      })),
    [loaderData.reference.accountManagers],
  );

  const arNameOptions = useMemo(
    () =>
      loaderData.reference.wholesaleBrokers.map((ar) => ({
        value: ar.authorisedRepresentativeId,
        label: ar.fullName,
        secondary: ar.companyName,
        searchText: `${ar.companyName} ${ar.arNumber}`,
      })),
    [loaderData.reference.wholesaleBrokers],
  );

  const arCompanyOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const ar of loaderData.reference.wholesaleBrokers) {
      const company = ar.companyName.trim();
      if (!company) continue;
      const key = company.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ value: company, label: company });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [loaderData.reference.wholesaleBrokers]);

  function buildParams(next?: {
    search?: string;
    accountManagerId?: number | "";
    authorisedRepresentativeId?: number | "";
    arCompanyName?: string;
    policyFilter?: "all" | "with" | "without";
    page?: number;
  }) {
    const q = (next?.search ?? search).trim();
    const manager = next?.accountManagerId ?? accountManagerId;
    const ar = next?.authorisedRepresentativeId ?? authorisedRepresentativeId;
    const company = (next?.arCompanyName ?? arCompanyName).trim();
    const policyFilter = next?.policyFilter ?? loaderData.filters.policyFilter;
    const page = next?.page ?? 1;

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (manager !== "") params.set("accountManager", String(manager));
    if (ar !== "") params.set("ar", String(ar));
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
    setAccountManagerId("");
    setAuthorisedRepresentativeId("");
    setArCompanyName("");
    setSearchParams({});
  }

  // Auto-search as you type (same cadence as global / select-client search).
  useEffect(() => {
    const next = search.trim();
    const current = loaderData.filters.search.trim();
    if (next === current) return;
    const timer = window.setTimeout(() => {
      setSearchParams(buildParams({ search: next, page: 1 }));
    }, 250);
    return () => window.clearTimeout(timer);
    // buildParams reads latest filter state from the render that scheduled this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on search text changes
  }, [search, loaderData.filters.search, setSearchParams]);

  const hasActiveFilters =
    Boolean(loaderData.filters.search) ||
    Boolean(loaderData.filters.accountManagerId) ||
    Boolean(loaderData.filters.authorisedRepresentativeId) ||
    Boolean(loaderData.filters.arCompanyName);

  const searchQuery = loaderData.filters.search.trim();

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
          <Link to="/clients/new">
            <Button>+ New Client</Button>
          </Link>
        }
      />

      <form
        className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters({ page: 1 });
        }}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="client-search-q">Search</Label>
          <div className="relative w-full">
            <Input
              id="client-search-q"
              name="q"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, trading name, ABN, phone…"
              className={cn("w-full", search.trim() && "pr-9")}
            />
            {search.trim() ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  applyFilters({ search: "", page: 1 });
                }}
              >
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FilterAutocomplete
            id="filter-account-manager"
            label="Account Manager"
            value={accountManagerId}
            onChange={(value) => {
              const next = value === "" ? "" : Number(value);
              setAccountManagerId(next);
              applyFilters({ accountManagerId: next, page: 1 });
            }}
            options={accountManagerOptions}
            placeholder="All account managers"
          />
          <FilterAutocomplete
            id="filter-ar-company"
            label="AR Company Name"
            value={arCompanyName}
            onChange={(value) => {
              const next = value === "" ? "" : String(value);
              setArCompanyName(next);
              applyFilters({ arCompanyName: next, page: 1 });
            }}
            options={arCompanyOptions}
            placeholder="All AR companies"
          />
          <FilterAutocomplete
            id="filter-ar-name"
            label="AR Name"
            value={authorisedRepresentativeId}
            onChange={(value) => {
              const next = value === "" ? "" : Number(value);
              setAuthorisedRepresentativeId(next);
              applyFilters({ authorisedRepresentativeId: next, page: 1 });
            }}
            options={arNameOptions}
            placeholder="All AR names"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {loaderData.total} clients found · {loaderData.withPolicies} with
            policies
          </p>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterTag
          active={loaderData.filters.policyFilter === "all"}
          onClick={() => applyFilters({ policyFilter: "all", page: 1 })}
        >
          All · {loaderData.allMatching}
        </FilterTag>
        <FilterTag
          active={loaderData.filters.policyFilter === "with"}
          onClick={() => applyFilters({ policyFilter: "with", page: 1 })}
        >
          With policies · {loaderData.withPolicies}
        </FilterTag>
        <FilterTag
          active={loaderData.filters.policyFilter === "without"}
          onClick={() => applyFilters({ policyFilter: "without", page: 1 })}
        >
          No policies · {loaderData.withoutPolicies}
        </FilterTag>
      </div>

      {actionData && !actionData.ok && actionData.error ? (
        <p className="mb-3 text-sm text-destructive">{actionData.error}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Account manager</TableHead>
              <TableHead>Policies</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaderData.clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UsersIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {loaderData.filters.search
                          ? "No match"
                          : "No clients found"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {loaderData.filters.search
                          ? `No match for “${loaderData.filters.search}”.`
                          : "No clients match the current filters."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              loaderData.clients.map((client) => {
                const manager = loaderData.reference.accountManagers.find(
                  (item) => item.accountManagerId === client.accountManagerId,
                );
                const canDelete = client.policyCount === 0;
                const nameMatches =
                  !searchQuery || fieldMatches(client.name, searchQuery);
                const tradingMatches =
                  Boolean(client.tradingName) &&
                  (!searchQuery ||
                    fieldMatches(client.tradingName, searchQuery));
                const managerName = manager?.fullName ?? "";
                const managerMatches =
                  Boolean(managerName) &&
                  searchQuery &&
                  fieldMatches(managerName, searchQuery);
                return (
                  <TableRow
                    key={client.clientId}
                    className="cursor-pointer"
                    onClick={() => navigate(`/clients/${client.clientId}`)}
                  >
                    <TableCell>
                      {nameMatches ? (
                        <p className="font-medium">
                          {searchQuery ? (
                            <HighlightText
                              text={client.name}
                              query={searchQuery}
                            />
                          ) : (
                            client.name
                          )}
                        </p>
                      ) : null}
                      {tradingMatches ? (
                        <p
                          className={
                            nameMatches
                              ? "text-xs text-muted-foreground"
                              : "font-medium"
                          }
                        >
                          {searchQuery ? (
                            <HighlightText
                              text={client.tradingName}
                              query={searchQuery}
                            />
                          ) : (
                            client.tradingName
                          )}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {managerName ? (
                        managerMatches ? (
                          <HighlightText
                            text={managerName}
                            query={searchQuery}
                          />
                        ) : (
                          managerName
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{client.policyCount}</TableCell>
                    <TableCell>{formatDate(client.createdWhen)}</TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Delete ${client.name}`}
                          onClick={() => setDeleting(client)}
                        >
                          <Trash2Icon />
                        </Button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className="inline-flex" />}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled
                              className="text-muted-foreground"
                              aria-label={`Cannot delete ${client.name}`}
                            >
                              <Trash2Icon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Clients with policies cannot be deleted
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          total={loaderData.total}
          page={loaderData.page}
          pageSize={loaderData.pageSize}
          pageHref={pageHref}
          pageSizeHref={pageSizeHref}
        />
      </div>

      <Dialog
        open={deleting != null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete client?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                {deleting?.name}
              </span>
              . This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={deleting?.clientId ?? ""} />
              <LoadingButton
                type="submit"
                variant="destructive"
                loading={deletingInFlight}
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
