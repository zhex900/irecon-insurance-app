import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import type { DocumentTemplateConfirmAction } from "~/hooks/document-template-editor/use-controller";

function confirmCopy(action: DocumentTemplateConfirmAction): {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: React.ComponentProps<typeof ConfirmDialog>["confirmVariant"];
} {
  switch (action.kind) {
    case "revert":
      return {
        title: "Revert layout changes?",
        description:
          "This reverts all layout edits since you opened this template, or since the last Save draft / Publish.",
        confirmLabel: "Revert",
        confirmVariant: "destructive",
      };
    case "publish":
      return {
        title: `Publish v${action.versionNumber}?`,
        description:
          "This sets the selected version as the published (live) template. PDF generation will use this version.",
        confirmLabel: "Publish",
      };
    case "undo":
      return {
        title: "Undo published version?",
        description:
          "The previous published version will become live, or nothing will remain published if no earlier version exists.",
        confirmLabel: "Undo publish",
        confirmVariant: "destructive",
      };
    case "load-version":
      return {
        title: `Load v${action.entry.versionNumber} into editor?`,
        description:
          "Unsaved edits in the designer will be replaced. Save a draft first if you need to keep them.",
        confirmLabel: "Replace edits",
        confirmVariant: "destructive",
      };
    case "delete-draft":
      return {
        title: `Delete draft v${action.versionNumber}?`,
        description:
          "This permanently removes the draft from history. Published versions are not affected.",
        confirmLabel: "Delete draft",
        confirmVariant: "destructive",
      };
  }
}

export function TemplateConfirmDialog({
  action,
  busy,
  intent,
  onOpenChange,
  onConfirm,
}: {
  action: DocumentTemplateConfirmAction | null;
  busy: boolean;
  intent: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  if (!action) return null;

  const copy = confirmCopy(action);
  const loading =
    busy &&
    ((action.kind === "publish" && intent === "publish-version") ||
      (action.kind === "undo" && intent === "undo") ||
      (action.kind === "delete-draft" && intent === "delete-draft"));

  return (
    <TemplateConfirmDialog
      action={action}
      busy={busy}
      intent={intent}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
