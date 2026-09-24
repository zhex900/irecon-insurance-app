import { Trash2Icon } from "lucide-react";

import { ClientPopover } from "~/components/clients/summary";
import type { DeletablePolicyRef } from "~/components/policies/delete-policies-dialog";
import { PolicySeriesLabel } from "~/components/policies/policy-series-label";
import { Badge } from "~/components/reui/badge";
import { SearchHighlight } from "~/components/search/highlight-cell";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  InteractiveTableActionsCell,
  InteractiveTableRow,
} from "~/components/ui/interactive-table-row";
import { StatusBadge } from "~/components/ui/status-badge";
import { TableCell } from "~/components/ui/table";
import type { ReferenceData } from "~/lib/db/types";
import { formatPolicySeriesReference } from "~/lib/policies/policy-series-term";
import { fieldMatches } from "~/lib/search/match";
import type { PolicyListItem } from "~/lib/services/policies/list.service";
import { formatCurrency, formatDate } from "~/lib/utils";
import { isTerminalStatus } from "~/lib/zod/policy-car";

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
  const policyReference = formatPolicySeriesReference(
    policy.policyNumber,
    policy.seriesTerm,
  );

  return (
    <InteractiveTableRow
      aria-label={`Open policy ${policyReference}`}
      onActivate={onActivate}
    >
      <InteractiveTableActionsCell>
        <Checkbox
          checked={selected}
          disabled={!canDelete}
          onCheckedChange={(value) =>
            onToggleSelected(policy.policyId, value === true)
          }
          aria-label={`Select ${policyReference}`}
        />
      </InteractiveTableActionsCell>
      <TableCell className="min-w-56 align-top whitespace-normal">
        <div className="min-w-0">
          <div className="flex flex-nowrap items-center gap-2">
            <PolicySeriesLabel
              seriesNumber={policy.policyNumber}
              seriesTerm={policy.seriesTerm}
              searchQuery={searchQuery}
              seriesClassName="whitespace-nowrap"
            />
            {policy.adjusted ? (
              <Badge variant="focus-light" size="sm" className="shrink-0">
                Adjusted
              </Badge>
            ) : null}
            {showDraftBadge && policy.isDraft ? (
              <Badge variant="warning-light" size="sm" className="shrink-0">
                Draft
              </Badge>
            ) : null}
          </div>
          {showInsured ? (
            <p className="mt-0.5 line-clamp-2 min-w-0 text-xs break-words text-muted-foreground">
              {searchQuery ? (
                <SearchHighlight
                  text={policy.insuredName}
                  query={searchQuery}
                />
              ) : (
                policy.insuredName
              )}
            </p>
          ) : null}
        </div>
      </TableCell>
      {showClientColumn ? (
        <InteractiveTableActionsCell className="max-w-48 align-top whitespace-normal">
          <ClientPopover
            className="line-clamp-2 block min-w-0 break-words whitespace-normal"
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
          </ClientPopover>
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled
            className="text-muted-foreground"
            aria-label={`Cannot delete ${policy.policyNumber}`}
            title="Taken and not taken policies cannot be deleted"
          >
            <Trash2Icon />
          </Button>
        )}
      </InteractiveTableActionsCell>
    </InteractiveTableRow>
  );
}
