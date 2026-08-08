import { EyeIcon, Redo2Icon, RotateCcwIcon, Undo2Icon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";

type EmailTemplateEditorActionsProps = {
  canEdit: boolean;
  busy: boolean;
  resetting: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  resetTitle: string;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onReset: () => void;
};

export function EmailTemplateEditorActions({
  canEdit,
  busy,
  resetting,
  saving,
  canUndo,
  canRedo,
  resetTitle,
  onUndo,
  onRedo,
  onPreview,
  onReset,
}: EmailTemplateEditorActionsProps) {
  const returnToList = () =>
    window.location.assign("/settings/email-templates");

  if (!canEdit) {
    return (
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="outline" size="sm" onClick={onPreview}>
          <EyeIcon data-icon="inline-start" />
          Preview
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={returnToList}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
      >
        <Undo2Icon data-icon="inline-start" />
        Undo
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
      >
        <Redo2Icon data-icon="inline-start" />
        Redo
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onPreview}>
        <EyeIcon data-icon="inline-start" />
        Preview
      </Button>
      <LoadingButton
        type="button"
        variant="outline"
        size="sm"
        loading={resetting}
        onClick={onReset}
        disabled={busy}
        title={resetTitle}
      >
        <RotateCcwIcon data-icon="inline-start" />
        Reset
      </LoadingButton>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={returnToList}
        disabled={busy}
      >
        Cancel
      </Button>
      <LoadingButton type="submit" size="sm" loading={saving}>
        Save
      </LoadingButton>
    </div>
  );
}
