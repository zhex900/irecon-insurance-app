import type { ReactNode } from "react";
import { Badge } from "~/components/reui/badge";
import type { CarWording, Policy, ReferenceData } from "~/lib/db/types";
import type { EmailTemplate, EmailTemplateVars } from "~/lib/email/templates";
import type { EmailDirectoryEntry } from "~/lib/email/directory";
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

export type CarPolicyWizardProps = {
  policy: Policy;
  reference: ReferenceData;
  carWording: CarWording[];
  readOnly?: boolean;
  freshSteps?: boolean;
  isNew?: boolean;
  clientName?: string;
  brokerName?: string;
  brokerEmail?: string;
  noteAuthors?: Record<string, NoteAuthor>;
  emailTemplates?: EmailTemplate[];
  emailDirectory?: EmailDirectoryEntry[];
  emailTemplateVars?: EmailTemplateVars;
  footerImageWidth?: number;
  headerActions?: ReactNode;
};
