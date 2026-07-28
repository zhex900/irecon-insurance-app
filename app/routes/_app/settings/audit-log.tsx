import { useMemo, useState } from "react";
import { Form, redirect, useSearchParams } from "react-router";
import { ScrollTextIcon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import { requireAuth } from "~/lib/auth/session.server";
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
import { Label } from "~/components/ui/label";
import { Select as NativeSelect } from "~/components/ui/form-controls";
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
import { AUDIT_ACTIONS } from "~/lib/services/audit/constants";
import { listAuditLogs } from "~/lib/services/audit/service";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import { listUsers } from "~/lib/services/users/service";
import type { AuditLogEntry } from "~/lib/db/types";
import type { Route } from "./+types/audit-log";

export function meta() {
  return [{ title: "Audit log | BrokerSure" }];
}

const PAGE_SIZE = 50;

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const auditLogEnabled = await isFeatureEnabled("audit_log");
  if (!auditLogEnabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const action = url.searchParams.get("action") ?? "";
  const actorUserId = url.searchParams.get("actor") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
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
  const [searchParams] = useSearchParams();

  const pageHref = useMemo(
    () => (nextPage: number) => pageSearchHref(searchParams, nextPage),
    [searchParams],
  );
  const pageSizeHref = useMemo(
    () => (nextPageSize: number) =>
      pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE),
    [searchParams],
  );

  const hasSearchFilters = Boolean(
    q.trim() || action || actorUserId || from || to,
  );

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Audit log" : "My activity"}
        description={
          isAdmin
            ? "Material actions across the app — who changed what and when."
            : "Your material actions in the app."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: isAdmin ? "Audit log" : "My activity" },
        ]}
      />

      <Form
        method="get"
        className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6"
      >
        <div className="xl:col-span-2">
          <Label htmlFor="q" className="sr-only">
            Search
          </Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search summary, actor, action…"
          />
        </div>
        <div>
          <Label htmlFor="action" className="sr-only">
            Action
          </Label>
          <NativeSelect id="action" name="action" defaultValue={action}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </NativeSelect>
        </div>
        {isAdmin ? (
          <div>
            <Label htmlFor="actor" className="sr-only">
              Actor
            </Label>
            <NativeSelect id="actor" name="actor" defaultValue={actorUserId}>
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.fullName || user.email}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div>
          <Label htmlFor="from" className="sr-only">
            From
          </Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Label htmlFor="to" className="sr-only">
              To
            </Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </div>
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
                ? q.trim()
                  ? `No match for “${q.trim()}”.`
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
                <TableRow
                  key={row.auditLogId}
                  className="cursor-pointer"
                  onClick={() => setDetail(row)}
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatWhen(row.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {row.actorName || row.actorEmail || "—"}
                      </span>
                      {row.actorName && row.actorEmail ? (
                        <span className="text-xs text-muted-foreground">
                          {row.actorEmail}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.action}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.entityType
                      ? `${row.entityType}${row.entityId ? ` #${row.entityId}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {row.summary}
                  </TableCell>
                </TableRow>
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
            <DialogTitle>Audit entry</DialogTitle>
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
