import { Badge } from "~/components/reui/badge";

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