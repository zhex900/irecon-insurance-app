export type PolicyStatusOption = {
  policyStatusId: number;
  name: string;
};

export type TerminalStatusValidation =
  | { ok: true }
  | {
      ok: false;
      requirements: BlockedRequirement[];
    };

export type BlockedRequirement = { label: string; message: string };

/** UI overlays driven by status selection — one active dialog at a time. */
export type StatusDialog =
  | { kind: "none" }
  | { kind: "confirm"; statusId: number }
  | { kind: "blocked"; statusId: number; requirements: BlockedRequirement[] };

export type PolicyStatusMenuProps = {
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
};
