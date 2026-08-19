import type { ReactNode } from "react";

import { Badge } from "~/components/reui/badge";
import type { Policy, ReferenceData } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";

export type WizardMode = "new" | "edit" | "view";

export function wizardModeBadge(mode: WizardMode) {
  if (mode === "new") {
    return (
      <Badge variant="primary-light" radius="full">
        New
      </Badge>
    );
  }
  if (mode === "edit") {
    return (
      <Badge variant="warning-light" radius="full">
        Editing
      </Badge>
    );
  }
  return (
    <Badge variant="success-light" radius="full">
      View only
    </Badge>
  );
}

export function wizardModeHeaderClass(mode: WizardMode) {
  if (mode === "new") {
    return "border-l-4 border-l-primary bg-primary/[0.06]";
  }
  if (mode === "edit") {
    return "border-l-4 border-l-warning bg-warning/[0.1]";
  }
  return "border-l-4 border-l-success bg-success/[0.08]";
}

export function wizardModeCardBorderClass(mode: WizardMode) {
  if (mode === "new") {
    return "border border-border border-l-4 border-l-primary";
  }
  if (mode === "edit") {
    return "border border-border border-l-4 border-l-warning";
  }
  return "border border-border border-l-4 border-l-success";
}

export type WizardProps = {
  policy: Policy;
  reference: ReferenceData;
  /** Live broker fee schedule still loading (`usePolicyFeeNames`). */
  referenceFeeNamesPending?: boolean;
  readOnly?: boolean;
  freshSteps?: boolean;
  isNew?: boolean;
  clientName?: string;
  noteAuthors?: Record<string, NoteAuthor>;
  onPolicyUpdated?: (policy: Policy) => void;
  headerActions?: ReactNode;
};
