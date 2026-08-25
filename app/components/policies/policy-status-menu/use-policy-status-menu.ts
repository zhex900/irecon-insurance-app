import { useEffect, useRef, useState } from "react";

import { isTerminalStatus } from "~/lib/zod/policy-car";

import { statusLabel } from "./status-label";
import type {
  BlockedRequirement,
  PolicyStatusMenuProps,
  StatusDialog,
  TerminalStatusValidation,
} from "./types";

type UsePolicyStatusMenuOptions = Pick<
  PolicyStatusMenuProps,
  | "statuses"
  | "value"
  | "disabled"
  | "onChange"
  | "onConfirmTerminal"
  | "validateTerminal"
  | "onTerminalInvalid"
  | "confirmBusy"
>;

export function usePolicyStatusMenu({
  statuses,
  value,
  disabled = false,
  onChange,
  onConfirmTerminal,
  validateTerminal,
  onTerminalInvalid,
  confirmBusy = false,
}: UsePolicyStatusMenuOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<StatusDialog>({ kind: "none" });
  const ignoreMenuReopenRef = useRef(false);
  const confirmSaveStartedRef = useRef(false);

  const selected =
    statuses.find((status) => status.policyStatusId === value) ?? null;
  const locked = disabled || isTerminalStatus(value);
  const confirmDialogOpen = dialog.kind === "confirm";
  const confirmStatusName = statusLabel(
    statuses,
    confirmDialogOpen ? dialog.statusId : null,
  );

  useEffect(() => {
    if (dialog.kind !== "confirm") {
      confirmSaveStartedRef.current = false;
      return;
    }
    if (confirmBusy) {
      confirmSaveStartedRef.current = true;
      return;
    }
    if (!confirmSaveStartedRef.current) return;
    confirmSaveStartedRef.current = false;
    setDialog({ kind: "none" });
  }, [dialog.kind, confirmBusy]);

  function closeMenu() {
    ignoreMenuReopenRef.current = true;
    setMenuOpen(false);
    requestAnimationFrame(() => {
      ignoreMenuReopenRef.current = false;
    });
  }

  function handleMenuOpenChange(open: boolean) {
    if (open && ignoreMenuReopenRef.current) return;
    setMenuOpen(open);
  }

  function blockTerminal(statusId: number, requirements: BlockedRequirement[]) {
    setDialog({ kind: "blocked", statusId, requirements });
    onTerminalInvalid?.(statusId);
  }

  function runTerminalValidation(statusId: number): TerminalStatusValidation {
    if (!validateTerminal) return { ok: true };
    return validateTerminal(statusId);
  }

  function pickStatus(next: number) {
    closeMenu();
    if (next === value) return;

    if (!isTerminalStatus(next)) {
      onChange(next);
      return;
    }

    const validation = runTerminalValidation(next);
    if (!validation.ok) {
      blockTerminal(next, validation.requirements);
      return;
    }

    setDialog({ kind: "confirm", statusId: next });
  }

  function confirmStatusChange() {
    if (dialog.kind !== "confirm") return;

    const validation = runTerminalValidation(dialog.statusId);
    if (!validation.ok) {
      blockTerminal(dialog.statusId, validation.requirements);
      return;
    }

    if (onConfirmTerminal) {
      confirmSaveStartedRef.current = false;
      onConfirmTerminal(dialog.statusId);
      return;
    }

    setDialog({ kind: "none" });
    onChange(dialog.statusId);
  }

  function cancelConfirm() {
    if (confirmDialogOpen && confirmBusy) return;
    setDialog({ kind: "none" });
  }

  function closeBlockedDialog(rehighlight: boolean) {
    if (dialog.kind !== "blocked") return;
    const { statusId } = dialog;
    setDialog({ kind: "none" });
    if (rehighlight) onTerminalInvalid?.(statusId);
  }

  return {
    menuOpen,
    handleMenuOpenChange,
    dialog,
    pickStatus,
    confirmStatusChange,
    cancelConfirm,
    closeBlockedDialog,
    confirmDialogOpen,
    confirmStatusName,
    confirmBusy: confirmDialogOpen && confirmBusy,
    selected,
    locked,
  };
}
