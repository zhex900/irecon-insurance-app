import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { LoadingButton } from "~/components/ui/loading-button";
import { StatusBadge } from "~/components/ui/status-badge";
import { cn } from "~/lib/utils";
import { isTerminalStatus, POLICY_STATUS } from "~/lib/zod/policy-car";

export type PolicyStatusOption = {
  policyStatusId: number;
  name: string;
};

export type TerminalStatusValidation =
  | { ok: true }
  | {
      ok: false;
      requirements: { label: string; message: string }[];
    };

const STATUS_DOT: Record<number, string> = {
  1: "bg-warning",
  2: "bg-success",
  3: "bg-muted-foreground",
};

function StatusDot({
  statusId,
  className,
}: {
  statusId: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        STATUS_DOT[statusId] ?? "bg-muted-foreground",
        className,
      )}
    />
  );
}

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
}: {
  statuses: PolicyStatusOption[];
  value: number;
  disabled?: boolean;
  /** Non-terminal status changes apply immediately. */
  onChange: (statusId: number) => void;
  /** Terminal statuses (Taken / Not taken) confirm before applying. */
  onConfirmTerminal?: (statusId: number) => void;
  /** Run before the Taken/Not taken confirm dialog. Return ok:false to block. */
  validateTerminal?: (statusId: number) => TerminalStatusValidation;
  /** Called when validation blocks a terminal status (e.g. navigate + highlight). */
  onTerminalInvalid?: (statusId: number) => void;
  confirmBusy?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const [pendingStatusId, setPendingStatusId] = useState<number | null>(null);
  const [blockedRequirements, setBlockedRequirements] = useState<
    { label: string; message: string }[] | null
  >(null);
  const [blockedStatusId, setBlockedStatusId] = useState<number | null>(null);
  const [awaitingConfirmSave, setAwaitingConfirmSave] = useState(false);
  const sawConfirmBusyRef = useRef(false);

  const selected =
    statuses.find((status) => status.policyStatusId === value) ?? null;
  const pendingStatusName =
    pendingStatusId == null
      ? null
      : (statuses.find((status) => status.policyStatusId === pendingStatusId)
          ?.name ?? null);

  const locked = disabled || isTerminalStatus(value);
  const confirmLoading = awaitingConfirmSave || confirmBusy;

  useEffect(() => {
    if (!awaitingConfirmSave) return;
    if (confirmBusy) {
      sawConfirmBusyRef.current = true;
      return;
    }
    if (!sawConfirmBusyRef.current) return;
    sawConfirmBusyRef.current = false;
    setAwaitingConfirmSave(false);
    setPendingStatusId(null);
  }, [awaitingConfirmSave, confirmBusy]);

  function selectStatus(next: number) {
    if (next === value) return;
    if (isTerminalStatus(next)) {
      if (validateTerminal) {
        const result = validateTerminal(next);
        if (!result.ok) {
          setBlockedStatusId(next);
          setBlockedRequirements(result.requirements);
          onTerminalInvalid?.(next);
          return;
        }
      }
      setPendingStatusId(next);
      return;
    }
    onChange(next);
  }

  function confirmStatusChange() {
    if (pendingStatusId == null) return;
    const next = pendingStatusId;
    // Re-validate Taken immediately before confirm — premiums may still be missing.
    if (next === POLICY_STATUS.Taken && validateTerminal) {
      const result = validateTerminal(next);
      if (!result.ok) {
        setPendingStatusId(null);
        setBlockedStatusId(next);
        setBlockedRequirements(result.requirements);
        onTerminalInvalid?.(next);
        return;
      }
    }
    if (onConfirmTerminal) {
      setAwaitingConfirmSave(true);
      sawConfirmBusyRef.current = false;
      onConfirmTerminal(next);
      return;
    }
    setPendingStatusId(null);
    onChange(next);
  }

  function cancelStatusChange() {
    if (confirmLoading) return;
    setPendingStatusId(null);
  }

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
      <DropdownMenu>
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
              return (
                <DropdownMenuItem
                  key={status.policyStatusId}
                  className="gap-2.5"
                  onClick={() => selectStatus(status.policyStatusId)}
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

      <Dialog
        open={pendingStatusId != null}
        onOpenChange={(open) => {
          if (!open) cancelStatusChange();
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Mark policy as {pendingStatusName ?? "selected status"}?
            </DialogTitle>
            <DialogDescription>
              This sets the status to{" "}
              {pendingStatusName ?? "the selected status"}. Taken and Not taken
              are final and cannot be changed afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={cancelStatusChange}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              onClick={confirmStatusChange}
              loading={confirmLoading}
            >
              Confirm
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={blockedRequirements != null}
        onOpenChange={(open) => {
          if (!open) {
            const statusId = blockedStatusId;
            setBlockedRequirements(null);
            setBlockedStatusId(null);
            // Re-apply highlight after the dialog closes so the pulse is visible.
            if (statusId != null) onTerminalInvalid?.(statusId);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Cannot mark as Taken</DialogTitle>
            <DialogDescription>
              Fix the following before this policy can be Taken. Status was not
              changed.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-3">
            {(blockedRequirements ?? []).map((item) => (
              <li
                key={item.label}
                className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2"
              >
                <p className="text-sm font-medium text-warning">{item.label}</p>
                <p className="mt-1 text-sm text-foreground">{item.message}</p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                const statusId = blockedStatusId;
                setBlockedRequirements(null);
                setBlockedStatusId(null);
                if (statusId != null) onTerminalInvalid?.(statusId);
              }}
            >
              Review highlighted fields
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
