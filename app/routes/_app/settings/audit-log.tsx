import { useState } from "react";
import { Form, redirect } from "react-router";
import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { ScrollTextIcon } from "lucide-react";
import { ListSearchField } from "~/components/forms/list-search-field";
import { PageHeader } from "~/components/layout/app-layout";
import { useDebouncedSearchQuery } from "~/hooks/use-debounced-search-query";
import { requireAuth } from "~/lib/auth/session.server";
import { optionalIsoDateSchema, queryTextSchema } from "~/lib/http/route-input";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { InteractiveTableRow } from "~/components/ui/interactive-table-row";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { SearchHighlight } from "~/components/search/highlight-cell";
import { fieldMatches } from "~/lib/search/match";
import { AUDIT_ACTIONS } from "~/lib/services/audit/constants";
import { listAuditLogs } from "~/lib/services/audit/service";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import { listUsers } from "~/lib/services/users/service";
import type { AuditLogEntry } from "~/lib/db/types";
import type { Route } from "./+types/audit-log";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Audit Log") }];
}

const PAGE_SIZE = 50;

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, "PPp", { locale: enAU });
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const auditLogEnabled = await isFeatureEnabled("audit_log");
  if (!auditLogEnabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }

  const url = new URL(request.url);
  const q = queryTextSchema.parse(url.searchParams.get("q") ?? "");
  const action = queryTextSchema.parse(url.searchParams.get("action") ?? "");
  const actorUserId = queryTextSchema.parse(
    url.searchParams.get("actor") ?? "",
  );
  const from =
    optionalIsoDateSchema.parse(url.searchParams.get("from") ?? undefined) ??
    "";
  const to =
    optionalIsoDateSchema.parse(url.searchParams.get("to") ?? undefined) ?? "";
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });
  const adminViewer = isAdminRole(viewer);

  const result = await listAuditLogs({
    viewer,
    q: q || undefined,
    action: action || undefined,
    actorUserId: adminViewer ? actorUserId || undefined : undefined,
    from: from || undefined,
    to: to || undefined,
    limit: pagination.limit,
    offset: pagination.offset,
  });

  const users = adminViewer ? await listUsers() : [];

  return {
    viewer,
    rows: result.rows,
    total: result.total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    q,
    action,
    actorUserId,
    from,
    to,
    users: users.map((u) => ({
      userId: u.userId,
      fullName: u.fullName,
      email: u.email,
    })),
  };
}

export default function SettingsAuditLogRoute({
  loaderData,
}: Route.ComponentProps) {
  const {
    viewer,
    rows,
    total,
    page,
    pageSize,
    q,
    action,
    actorUserId,
    from,
    to,
    users,
  } = loaderData;
  const isAdmin = isAdminRole(viewer);
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);
  const { search, setSearch, clearSearch, searchQuery, searchParams } =
    useDebouncedSearchQuery(q);

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE);

  const hasSearchFilters = Boolean(
    searchQuery || action || actorUserId || from || to,
  );

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Audit Log" : "My Activity"}
        description={
          isAdmin
            ? "Material actions across the app — who changed what and when."
            : "Your material actions in the app."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: isAdmin ? "Audit Log" : "My Activity" },
        ]}
      />

      <Form
        method="get"
        className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6"
      >
        <FieldGroup className="gap-3 xl:col-span-2">
          <Field>
            <FieldLabel htmlFor="audit-search-q" className="sr-only">
              Search
            </FieldLabel>
            <input type="hidden" name="q" value={search.trim()} />
            <ListSearchField
              id="audit-search-q"
              value={search}
              onChange={setSearch}
              onClear={clearSearch}
              placeholder="Search summary, actor, action…"
              aria-label="Search audit log"
              className="max-w-none"
            />
          </Field>
        </FieldGroup>
        <Field>
          <FieldLabel htmlFor="action" className="sr-only">
            Action
          </FieldLabel>
          <NativeSelect
            id="action"
            name="action"
            defaultValue={action}
            className="w-full"
          >
            <NativeSelectOption value="">All actions</NativeSelectOption>
            {AUDIT_ACTIONS.map((code) => (
              <NativeSelectOption key={code} value={code}>
                {code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {isAdmin ? (
          <Field>
            <FieldLabel htmlFor="actor" className="sr-only">
              Actor
            </FieldLabel>
            <NativeSelect
              id="actor"
              name="actor"
              defaultValue={actorUserId}
              className="w-full"
            >
              <NativeSelectOption value="">All users</NativeSelectOption>
              {users.map((user) => (
                <NativeSelectOption key={user.userId} value={user.userId}>
                  {user.fullName || user.email}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="from" className="sr-only">
            From
          </FieldLabel>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </Field>
        <Field className="flex-row items-end gap-2">
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor="to" className="sr-only">
              To
            </FieldLabel>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </Field>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </Field>
      </Form>

      {rows.length === 0 ? (
        <Empty className="border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollTextIcon />
            </EmptyMedia>
            <EmptyTitle>
              {hasSearchFilters ? "No match" : "No audit entries"}
            </EmptyTitle>
            <EmptyDescription>
              {hasSearchFilters
                ? searchQuery
                  ? `No match for “${searchQuery}”.`
                  : "No audit entries match the current filters."
                : "Material actions will appear here after login, saves, and settings changes."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <InteractiveTableRow
                  key={row.auditLogId}
                  aria-label={`View audit entry ${row.action}`}
                  onActivate={() => setDetail(row)}
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatWhen(row.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {row.actorName ? (
                          <SearchHighlight
                            text={row.actorName}
                            query={searchQuery}
                          />
                        ) : row.actorEmail ? (
                          <SearchHighlight
                            text={row.actorEmail}
                            query={searchQuery}
                          />
                        ) : (
                          "—"
                        )}
                      </span>
                      {row.actorName &&
                      row.actorEmail &&
                      (!searchQuery ||
                        fieldMatches(row.actorEmail, searchQuery)) ? (
                        <span className="text-xs text-muted-foreground">
                          <SearchHighlight
                            text={row.actorEmail}
                            query={searchQuery}
                          />
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <SearchHighlight text={row.action} query={searchQuery} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.entityType
                      ? `${row.entityType}${row.entityId ? ` #${row.entityId}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    <SearchHighlight text={row.summary} query={searchQuery} />
                  </TableCell>
                </InteractiveTableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <TablePagination
            total={total}
            page={page}
            pageSize={pageSize}
            pageHref={pageHref}
            pageSizeHref={pageSizeHref}
          />
        </div>
      ) : null}

      <Dialog
        open={detail != null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Entry</DialogTitle>
            <DialogDescription>
              {detail ? formatWhen(detail.occurredAt) : null}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Action</p>
                <p className="font-mono">{detail.action}</p>
              </div>
              <div>
                <p className="text-muted-foreground">User</p>
                <p>
                  {detail.actorName || "—"}
                  {detail.actorEmail ? (
                    <span className="text-muted-foreground">
                      {" "}
                      ({detail.actorEmail})
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Entity</p>
                <p>
                  {detail.entityType
                    ? `${detail.entityType}${detail.entityId ? ` #${detail.entityId}` : ""}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Summary</p>
                <p>{detail.summary}</p>
              </div>
              {detail.requestPath ? (
                <div>
                  <p className="text-muted-foreground">Path</p>
                  <p className="font-mono text-xs">{detail.requestPath}</p>
                </div>
              ) : null}
              <div>
                <p className="text-muted-foreground">Metadata</p>
                <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(detail.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
