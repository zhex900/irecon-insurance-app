import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { StatusBadge } from "~/components/ui/status-badge";
import { cn } from "~/lib/utils";
import { isTerminalStatus } from "~/lib/zod/policy-car";

import { BlockedTakenDialog } from "./blocked-taken-dialog";
import { StatusDot } from "./status-dot";
import { TerminalConfirmDialog } from "./terminal-confirm-dialog";
import type { PolicyStatusMenuProps } from "./types";
import { usePolicyStatusMenu } from "./use-policy-status-menu";

export function PolicyStatusMenu({
  statuses,
  value,
  disabled = false,
  onChange,
  onConfirmTerminal,
  validateTerminal,
  onTerminalInvalid,
  confirmBusy = false,
  className,
  align = "start",
}: PolicyStatusMenuProps) {
  const {
    menuOpen,
    handleMenuOpenChange,
    dialog,
    pickStatus,
    confirmStatusChange,
    cancelConfirm,
    closeBlockedDialog,
    confirmDialogOpen,
    confirmStatusName,
    confirmBusy: confirmDialogBusy,
    selected,
    locked,
  } = usePolicyStatusMenu({
    statuses,
    value,
    disabled,
    onChange,
    onConfirmTerminal,
    validateTerminal,
    onTerminalInvalid,
    confirmBusy,
  });

  if (locked) {
    return selected ? (
      <StatusBadge
        statusId={selected.policyStatusId}
        name={selected.name}
        className={className}
      />
    ) : (
      <span className={cn("text-sm text-muted-foreground", className)}>—</span>
    );
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("min-w-40 justify-between gap-2", className)}
              aria-label="Policy status"
            >
              <span className="flex min-w-0 items-center gap-2">
                {selected ? (
                  <>
                    <StatusDot statusId={selected.policyStatusId} />
                    <span className="truncate text-sm font-medium">
                      {selected.name}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Select status
                  </span>
                )}
              </span>
              <ChevronsUpDownIcon
                className="size-3.5 shrink-0 opacity-60"
                aria-hidden
              />
            </Button>
          }
        />
        <DropdownMenuContent className="min-w-48" align={align} sideOffset={8}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {statuses.map((status) => {
              const active = status.policyStatusId === value;
              const terminal = isTerminalStatus(status.policyStatusId);

              return (
                <DropdownMenuItem
                  key={status.policyStatusId}
                  className="gap-2.5"
                  closeOnClick={!terminal}
                  onClick={() => pickStatus(status.policyStatusId)}
                >
                  <StatusDot statusId={status.policyStatusId} />
                  <span className="flex-1 text-sm font-medium">
                    {status.name}
                  </span>
                  {active ? (
                    <CheckIcon className="size-4 text-primary" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <TerminalConfirmDialog
        open={confirmDialogOpen}
        statusName={confirmStatusName}
        confirmBusy={confirmDialogBusy}
        onCancel={cancelConfirm}
        onConfirm={confirmStatusChange}
      />

      <BlockedTakenDialog
        open={dialog.kind === "blocked"}
        requirements={dialog.kind === "blocked" ? dialog.requirements : []}
        onClose={closeBlockedDialog}
      />
    </>
  );
}
