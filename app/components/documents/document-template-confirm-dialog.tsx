import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import type { DocumentTemplateConfirmAction } from "~/hooks/use-document-template-editor-controller";

function confirmCopy(action: DocumentTemplateConfirmAction): {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: React.ComponentProps<typeof ConfirmDialog>["confirmVariant"];
  loadingLabel?: string;
} {
  switch (action.kind) {
    case "revert":
      return {
        title: "Revert layout changes?",
        description:
          "This reverts all layout edits since you opened this template, or since the last Save draft / Publish.",
        confirmLabel: "Revert",
        confirmVariant: "destructive",
        loadingLabel: "Reverting…",
      };
    case "publish":
      return {
        title: `Publish v${action.versionNumber}?`,
        description:
          "This sets the selected version as the published (live) template. PDF generation will use this version.",
        confirmLabel: "Publish",
        loadingLabel: "Publishing…",
      };
    case "undo":
      return {
        title: "Undo published version?",
        description:
          "The previous published version will become live, or nothing will remain published if no earlier version exists.",
        confirmLabel: "Undo publish",
        confirmVariant: "destructive",
        loadingLabel: "Undoing…",
      };
    case "load-version":
      return {
        title: `Load v${action.entry.versionNumber} into editor?`,
        description:
          "Unsaved edits in the designer will be replaced. Save a draft first if you need to keep them.",
        confirmLabel: "Replace edits",
        confirmVariant: "destructive",
        loadingLabel: "Loading…",
      };
  }
}

export function DocumentTemplateConfirmDialog({
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
      (action.kind === "undo" && intent === "undo"));

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      confirmVariant={copy.confirmVariant}
      loading={loading}
      loadingLabel={copy.loadingLabel}
      onConfirm={onConfirm}
    />
  );
}
