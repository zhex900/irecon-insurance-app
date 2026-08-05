import { useNavigate } from "react-router";
import { Trash2Icon, UsersIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  InteractiveTableActionsCell,
  InteractiveTableRow,
} from "~/components/ui/interactive-table-row";
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
import { SearchHighlight } from "~/components/search/highlight-cell";
import { fieldMatches } from "~/lib/search/match";
import type { ReferenceData } from "~/lib/db/types";
import type { ClientListItem } from "~/lib/services/clients/list.service";
import { formatDate } from "~/lib/utils";

export type ClientsIndexTableProps = {
  clients: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  searchQuery: string;
  searchFilter: string;
  reference: ReferenceData;
  pageHref: (page: number) => string;
  pageSizeHref: (pageSize: number) => string;
  onDeleteRequest: (client: ClientListItem) => void;
};

export function ClientsIndexTable({
  clients,
  total,
  page,
  pageSize,
  searchQuery,
  searchFilter,
  reference,
  pageHref,
  pageSizeHref,
  onDeleteRequest,
}: ClientsIndexTableProps) {
  const navigate = useNavigate();

  return (
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
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersIcon />
                    </EmptyMedia>
                    <EmptyTitle>
                      {searchFilter ? "No match" : "No clients found"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {searchFilter
                        ? `No match for “${searchFilter}”.`
                        : "No clients match the current filters."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => {
              const manager = reference.accountManagers.find(
                (item) => item.accountManagerId === client.accountManagerId,
              );
              const ar = reference.wholesaleBrokers.find(
                (item) =>
                  item.authorisedRepresentativeId ===
                  client.authorisedRepresentativeId,
              );
              const canDelete = client.policyCount === 0;
              const managerName = manager?.fullName ?? "";
              const offColumnMatches = searchQuery
                ? (
                    [
                      { label: "ABN", value: client.abn },
                      { label: "Phone", value: client.phone },
                      { label: "Email", value: client.email },
                      { label: "AR Name", value: ar?.fullName ?? "" },
                      { label: "AR Company", value: ar?.companyName ?? "" },
                    ] as const
                  ).filter((field) => fieldMatches(field.value, searchQuery))
                : [];

              return (
                <InteractiveTableRow
                  key={client.clientId}
                  aria-label={`Open client ${client.name || client.clientId}`}
                  onActivate={() => navigate(`/clients/${client.clientId}`)}
                >
                  <TableCell>
                    <p className="font-medium">
                      <SearchHighlight
                        text={client.name || "—"}
                        query={searchQuery}
                      />
                    </p>
                    {client.tradingName ? (
                      <p className="text-xs text-muted-foreground">
                        <SearchHighlight
                          text={client.tradingName}
                          query={searchQuery}
                        />
                      </p>
                    ) : null}
                    {offColumnMatches.length > 0 ? (
                      <div className="mt-0.5 flex min-w-0 flex-col gap-0.5">
                        {offColumnMatches.map((field) => (
                          <p
                            key={field.label}
                            className="truncate text-xs text-muted-foreground"
                          >
                            <span className="font-medium text-foreground/70">
                              {field.label}:{" "}
                            </span>
                            <SearchHighlight
                              text={field.value}
                              query={searchQuery}
                            />
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {managerName ? (
                      <SearchHighlight text={managerName} query={searchQuery} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{client.policyCount}</TableCell>
                  <TableCell>{formatDate(client.createdWhen)}</TableCell>
                  <InteractiveTableActionsCell className="text-right">
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${client.name}`}
                        onClick={() => onDeleteRequest(client)}
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
                  </InteractiveTableActionsCell>
                </InteractiveTableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        pageHref={pageHref}
        pageSizeHref={pageSizeHref}
      />
    </div>
  );
}
