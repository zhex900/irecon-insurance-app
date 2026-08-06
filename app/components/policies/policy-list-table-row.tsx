import { Trash2Icon } from "lucide-react";
import { ClientSummaryPopover } from "~/components/clients/client-summary-popover";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  InteractiveTableActionsCell,
  InteractiveTableRow,
} from "~/components/ui/interactive-table-row";
import { TableCell } from "~/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { SearchHighlight } from "~/components/search/highlight-cell";
import { fieldMatches } from "~/lib/search/match";
import type { ReferenceData } from "~/lib/db/types";
import type { PolicyListItem } from "~/lib/services/policies/list.service";
import { formatCurrency, formatDate } from "~/lib/utils";
import { StatusBadge } from "~/components/ui/status-badge";
import { isTerminalStatus } from "~/lib/zod/policy-car";
import type { DeletablePolicyRef } from "~/components/policies/delete-policies-dialog";

export type PolicyListTableRowProps = {
  policy: PolicyListItem;
  reference: ReferenceData;
  searchQuery: string;
  showClientColumn: boolean;
  showDraftBadge: boolean;
  selected: boolean;
  onToggleSelected: (policyId: string, checked: boolean) => void;
  onActivate: () => void;
  onDeleteRequest: (policy: DeletablePolicyRef) => void;
};

export function PolicyListTableRow({
  policy,
  reference,
  searchQuery,
  showClientColumn,
  showDraftBadge,
  selected,
  onToggleSelected,
  onActivate,
  onDeleteRequest,
}: PolicyListTableRowProps) {
  const status = reference.policyStatuses.find(
    (item) => item.policyStatusId === policy.policyStatusId,
  );
  const cover = reference.coverTypes.find(
    (item) => item.coverTypeId === policy.coverTypeId,
  );
  const category = reference.policyCategories.find(
    (item) => item.policyCategoryId === policy.policyCategoryId,
  );
  const canDelete = !isTerminalStatus(policy.policyStatusId);
  const showInsured =
    Boolean(policy.insuredName) &&
    (!searchQuery || fieldMatches(policy.insuredName, searchQuery));
  const clientNameMatches =
    !searchQuery ||
    fieldMatches(policy.client.name, searchQuery) ||
    fieldMatches(policy.client.tradingName ?? "", searchQuery);

  return (
    <InteractiveTableRow
      aria-label={`Open policy ${policy.policyNumber}`}
      onActivate={onActivate}
    >
      <InteractiveTableActionsCell>
        <Checkbox
          checked={selected}
          disabled={!canDelete}
          onCheckedChange={(value) =>
            onToggleSelected(policy.policyId, value === true)
          }
          aria-label={`Select ${policy.policyNumber}`}
        />
      </InteractiveTableActionsCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {searchQuery ? (
              <SearchHighlight text={policy.policyNumber} query={searchQuery} />
            ) : (
              policy.policyNumber
            )}
          </span>
          {policy.adjusted ? (
            <Badge variant="info-light" size="sm">
              Adjusted
            </Badge>
          ) : null}
          {showDraftBadge && policy.isDraft ? (
            <Badge variant="warning-light" size="sm">
              Draft
            </Badge>
          ) : null}
        </div>
        {showInsured ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {searchQuery ? (
              <SearchHighlight text={policy.insuredName} query={searchQuery} />
            ) : (
              policy.insuredName
            )}
          </p>
        ) : null}
      </TableCell>
      {showClientColumn ? (
        <InteractiveTableActionsCell>
          <ClientSummaryPopover
            client={{
              ...policy.client,
              accountManagerName: reference.accountManagers.find(
                (item) =>
                  item.accountManagerId === policy.client.accountManagerId,
              )?.fullName,
            }}
          >
            {searchQuery && clientNameMatches ? (
              fieldMatches(policy.client.name, searchQuery) ? (
                <SearchHighlight
                  text={policy.client.name}
                  query={searchQuery}
                />
              ) : (
                <SearchHighlight
                  text={policy.client.tradingName || policy.client.name}
                  query={searchQuery}
                />
              )
            ) : (
              policy.client.name || "—"
            )}
          </ClientSummaryPopover>
        </InteractiveTableActionsCell>
      ) : null}
      <TableCell>
        <StatusBadge
          statusId={policy.policyStatusId}
          name={status?.name ?? "—"}
        />
      </TableCell>
      <TableCell>{cover?.name ?? "—"}</TableCell>
      <TableCell>{category?.name ?? "—"}</TableCell>
      <TableCell>{formatDate(policy.dateStart)}</TableCell>
      <TableCell>{formatDate(policy.dateEnd)}</TableCell>
      <TableCell className="text-right font-medium">
        {policy.originalTotalPremium != null
          ? formatCurrency(policy.originalTotalPremium)
          : "—"}
      </TableCell>
      <InteractiveTableActionsCell className="text-right">
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete ${policy.policyNumber}`}
            onClick={() =>
              onDeleteRequest({
                policyId: policy.policyId,
                policyNumber: policy.policyNumber,
              })
            }
          >
            <Trash2Icon />
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled
                className="text-muted-foreground"
                aria-label={`Cannot delete ${policy.policyNumber}`}
              >
                <Trash2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Taken and not taken policies cannot be deleted
            </TooltipContent>
          </Tooltip>
        )}
      </InteractiveTableActionsCell>
    </InteractiveTableRow>
  );
}
