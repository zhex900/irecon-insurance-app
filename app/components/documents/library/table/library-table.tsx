import {
  CheckIcon,
  CloudUploadIcon,
  FileTypeIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import {
  coverTypeLabel,
  type CoverTypeOption,
  type UploadItem,
} from "~/components/documents/shared";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  InteractiveTableActionsCell,
  InteractiveTableRow,
} from "~/components/ui/interactive-table-row";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatBytes } from "~/hooks/utilities";
import { DOCUMENT_LABEL_MAX_LENGTH } from "~/lib/documents/document-label";
import type { LibraryDocumentRecord } from "~/lib/documents/library-documents";
import { formatDate } from "~/lib/utils";

type LibraryDocumentsTableProps = {
  files: UploadItem[];
  documentsById: Map<string, LibraryDocumentRecord>;
  coverTypes: CoverTypeOption[];
  canEdit: boolean;
  deletingId: string;
  uploadingClientId: string;
  editingLabelId: number | null;
  labelDraft: string;
  labelBusy: boolean;
  onPreview: (document: LibraryDocumentRecord) => void;
  onLabelDraftChange: (value: string) => void;
  onStartEditLabel: (document: LibraryDocumentRecord) => void;
  onCancelEditLabel: () => void;
  onSaveLabel: (document: LibraryDocumentRecord) => void;
  onEditCoverTypes: (document: LibraryDocumentRecord) => void;
  onDelete: (fileId: string) => void;
  onAddFiles: () => void;
};

export function LibraryTable({
  files: uploadFiles,
  documentsById: docsById,
  coverTypes,
  canEdit,
  deletingId,
  uploadingClientId,
  editingLabelId,
  labelDraft,
  labelBusy,
  onPreview: setPreviewDoc,
  onLabelDraftChange: setLabelDraft,
  onStartEditLabel: startEditLabel,
  onCancelEditLabel,
  onSaveLabel: saveLabel,
  onEditCoverTypes: openCoverTypesDialog,
  onDelete: removeUploadFile,
  onAddFiles: openFileDialog,
}: LibraryDocumentsTableProps) {
  return uploadFiles.length > 0 ? (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Files ({uploadFiles.length})</h3>
        {canEdit ? (
          <Button onClick={openFileDialog} variant="outline" size="sm">
            <CloudUploadIcon className="size-4" />
            Add files
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="h-9 ps-4">File</TableHead>
              <TableHead className="h-9 w-48">Label</TableHead>
              <TableHead className="h-9 min-w-40">Cover type</TableHead>
              <TableHead className="h-9">Size</TableHead>
              <TableHead className="h-9">Created</TableHead>
              {canEdit ? (
                <TableHead className="h-9 w-14 ps-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {uploadFiles.map((fileItem) => {
              const doc =
                fileItem.libraryDocumentId != null
                  ? docsById.get(String(fileItem.libraryDocumentId))
                  : undefined;
              const canPreview = fileItem.status === "completed" && doc != null;
              const isDeleting =
                fileItem.libraryDocumentId != null &&
                deletingId === String(fileItem.libraryDocumentId);
              const isUploading =
                fileItem.status === "uploading" ||
                uploadingClientId === fileItem.id;
              const isEditingLabel =
                doc != null && editingLabelId === doc.libraryDocumentId;

              return (
                <InteractiveTableRow
                  key={fileItem.id}
                  disabled={!canPreview || isEditingLabel}
                  aria-label={
                    doc
                      ? `Preview ${doc.filename}`
                      : `Upload ${fileItem.file.name}`
                  }
                  onActivate={() => {
                    if (canPreview && doc && !isEditingLabel) {
                      setPreviewDoc(doc);
                    }
                  }}
                >
                  <TableCell className="py-2 ps-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center text-destructive">
                        {isUploading ? (
                          <Spinner className="size-4" />
                        ) : (
                          <FileTypeIcon className="size-4" />
                        )}
                      </div>
                      <p
                        className="truncate text-sm font-medium"
                        title={fileItem.file.name}
                      >
                        {fileItem.file.name}
                      </p>
                      {fileItem.status === "error" ? (
                        <Badge variant="destructive-light" size="sm">
                          Error
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <InteractiveTableActionsCell className="py-2">
                    {doc == null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : isEditingLabel ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={labelDraft}
                          maxLength={DOCUMENT_LABEL_MAX_LENGTH}
                          aria-label="Document label"
                          disabled={labelBusy}
                          className="h-8 text-sm"
                          autoFocus
                          onChange={(event) =>
                            setLabelDraft(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              saveLabel(doc);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              onCancelEditLabel();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          disabled={labelBusy}
                          aria-label="Save label"
                          onClick={() => saveLabel(doc)}
                        >
                          {labelBusy ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <CheckIcon className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          disabled={labelBusy}
                          aria-label="Cancel label edit"
                          onClick={onCancelEditLabel}
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span
                          className="truncate text-sm font-medium"
                          title={doc.displayName}
                        >
                          {doc.displayName}
                        </span>
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            aria-label={`Edit label for ${doc.filename}`}
                            onClick={() => startEditLabel(doc)}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </InteractiveTableActionsCell>
                  <InteractiveTableActionsCell className="py-2">
                    {doc == null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {doc.coverTypeIds.length === 0 ? (
                            <span className="text-sm text-muted-foreground">
                              None
                            </span>
                          ) : (
                            coverTypes
                              .filter((cover) =>
                                doc.coverTypeIds.includes(cover.coverTypeId),
                              )
                              .map((cover) => (
                                <Badge
                                  key={cover.coverTypeId}
                                  variant="secondary"
                                  size="sm"
                                >
                                  {cover.name}
                                </Badge>
                              ))
                          )}
                        </div>
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            aria-label={`Edit cover types for ${doc.filename}`}
                            title={coverTypeLabel(doc.coverTypeIds, coverTypes)}
                            onClick={() => openCoverTypesDialog(doc)}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </InteractiveTableActionsCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">
                    {formatBytes(fileItem.file.size)}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground tabular-nums">
                    {doc?.createdWhen ? formatDate(doc.createdWhen) : "—"}
                  </TableCell>
                  {canEdit ? (
                    <InteractiveTableActionsCell className="py-2">
                      <Button
                        onClick={() => removeUploadFile(fileItem.id)}
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={fileItem.status === "uploading" || isDeleting}
                        aria-label={`Delete ${fileItem.file.name}`}
                      >
                        {isDeleting ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <Trash2Icon className="size-3.5" />
                        )}
                      </Button>
                    </InteractiveTableActionsCell>
                  ) : null}
                </InteractiveTableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  ) : null;
}
