import { Badge } from "~/components/reui/badge";

/** Published / draft version only — autosave is silent (no save-state badges). */
export function TemplateVersionBadges({
  publishedVersionNumber,
  editingVersionNumber,
  editingIsPublished,
}: {
  publishedVersionNumber: number | null;
  editingVersionNumber: number | null;
  editingIsPublished: boolean;
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
    </>
  );
}
