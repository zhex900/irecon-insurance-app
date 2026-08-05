import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function TemplateVersionBadges({
  publishedVersionNumber,
  editingVersionNumber,
  editingIsPublished,
  unsavedCount,
  autosaveStatus,
}: {
  publishedVersionNumber: number | null;
  editingVersionNumber: number | null;
  editingIsPublished: boolean;
  unsavedCount: number;
  autosaveStatus: "idle" | "pending" | "saving" | "saved";
}) {
  return (
    <>
      {publishedVersionNumber != null ? (
        <Badge variant="success-light" size="sm" radius="full">
          Published v{publishedVersionNumber}
        </Badge>
      ) : (
        <Badge variant="warning-light" size="sm" radius="full">
          Not published
        </Badge>
      )}
      {editingVersionNumber != null &&
      editingVersionNumber !== publishedVersionNumber ? (
        <Badge variant="warning-light" size="sm" radius="full">
          Draft v{editingVersionNumber}
        </Badge>
      ) : editingIsPublished ? (
        <Badge variant="info-light" size="sm" radius="full">
          Editing published
        </Badge>
      ) : null}
      {autosaveStatus === "saving" || autosaveStatus === "pending" ? (
        <Badge variant="secondary" size="sm" radius="full">
          {autosaveStatus === "saving" ? "Saving draft…" : "Autosave pending…"}
        </Badge>
      ) : autosaveStatus === "saved" && unsavedCount === 0 ? (
        <Badge variant="success-light" size="sm" radius="full">
          Draft saved
        </Badge>
      ) : unsavedCount > 0 ? (
        <Badge variant="destructive-light" size="sm" radius="full">
          Unsaved changes · {unsavedCount}
        </Badge>
      ) : null}
    </>
  );
}

export function EditableTitle({
  displayTitle,
  value,
  canEdit,
  busy,
  editing,
  onEditingChange,
  onChange,
  onSave,
  onCancel,
}: {
  displayTitle: string;
  value: string;
  canEdit: boolean;
  busy: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="truncate text-2xl font-semibold tracking-tight">
          {displayTitle}
        </h2>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit title"
            disabled={busy}
            onClick={() => onEditingChange(true)}
          >
            <PencilIcon />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex max-w-xl min-w-0 flex-1 items-center gap-1.5">
      <Input
        value={value}
        autoFocus
        aria-label="Template title"
        disabled={busy}
        className="h-9 text-base font-semibold md:text-lg"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave(value.trim() || value);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Save title"
        disabled={busy || !value.trim()}
        onClick={() => onSave(value.trim())}
      >
        <CheckIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel title edit"
        disabled={busy}
        onClick={onCancel}
      >
        <XIcon />
      </Button>
    </div>
  );
}
