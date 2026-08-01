import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import {
  CheckIcon,
  CircleAlertIcon,
  CloudUploadIcon,
  FileTypeIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PdfPreviewDialog } from "~/components/pdf-preview-dialog";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  formatBytes,
  useFileUpload,
  type FileMetadata,
  type FileWithPreview,
} from "~/hooks/use-file-upload";
import {
  DOCUMENT_LABEL_MAX_LENGTH,
  normalizeDocumentLabel,
} from "~/lib/documents/document-label";
import {
  libraryDocumentPublicPath,
  type LibraryDocumentRecord,
} from "~/lib/library-documents";
import { cn, formatDate } from "~/lib/utils";

type CoverTypeOption = {
  coverTypeId: number;
  name: string;
};

type UploadItem = FileWithPreview & {
  status: "uploading" | "completed" | "error";
  error?: string;
  libraryDocumentId?: number;
};

type ActionData =
  | {
      ok: true;
      intent: "upload";
      clientId: string;
      document: LibraryDocumentRecord;
    }
  | { ok: true; intent: "delete"; id: number }
  | {
      ok: true;
      intent: "update-label";
      document: LibraryDocumentRecord;
    }
  | {
      ok: true;
      intent: "update-cover-types";
      document: LibraryDocumentRecord;
    }
  | { ok: false; error: string; clientId?: string };

const MAX_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 20;

function toMetadata(docs: LibraryDocumentRecord[]): FileMetadata[] {
  return docs.map((doc) => ({
    id: String(doc.libraryDocumentId),
    name: doc.filename,
    size: doc.sizeBytes,
    type: doc.contentType || "application/pdf",
    url: libraryDocumentPublicPath(doc.libraryDocumentId),
  }));
}

function toUploadItems(docs: LibraryDocumentRecord[]): UploadItem[] {
  return toMetadata(docs).map((file) => ({
    id: file.id,
    file: {
      name: file.name,
      size: file.size,
      type: file.type,
    } as File,
    preview: file.url,
    status: "completed" as const,
    libraryDocumentId: Number(file.id),
  }));
}

function completedItem(doc: LibraryDocumentRecord): UploadItem {
  return {
    id: String(doc.libraryDocumentId),
    file: {
      name: doc.filename,
      size: doc.sizeBytes,
      type: doc.contentType || "application/pdf",
    } as File,
    preview: libraryDocumentPublicPath(doc.libraryDocumentId),
    status: "completed",
    libraryDocumentId: doc.libraryDocumentId,
  };
}

function coverTypeLabel(
  coverTypeIds: number[],
  coverTypes: CoverTypeOption[],
): string {
  if (coverTypeIds.length === 0) return "None";
  return coverTypes
    .filter((cover) => coverTypeIds.includes(cover.coverTypeId))
    .map((cover) => cover.name)
    .join(", ");
}

export function LibraryDocumentsManager({
  documents,
  coverTypes,
  canEdit,
}: {
  documents: LibraryDocumentRecord[];
  coverTypes: CoverTypeOption[];
  canEdit: boolean;
}) {
  const revalidator = useRevalidator();
  const uploadFetcher = useFetcher<ActionData>();
  const deleteFetcher = useFetcher<ActionData>();
  const labelFetcher = useFetcher<ActionData>();
  const coverFetcher = useFetcher<ActionData>();

  const [uploadFiles, setUploadFiles] = useState<UploadItem[]>(() =>
    toUploadItems(documents),
  );
  const [previewDoc, setPreviewDoc] = useState<LibraryDocumentRecord | null>(
    null,
  );
  const [docsById, setDocsById] = useState(
    () => new Map(documents.map((d) => [String(d.libraryDocumentId), d])),
  );
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [coverEditDoc, setCoverEditDoc] =
    useState<LibraryDocumentRecord | null>(null);
  const [coverDraftIds, setCoverDraftIds] = useState<number[]>([]);

  /** Upload queue — drained one-at-a-time via kickUpload. */
  const queueRef = useRef<Array<{ clientId: string; file: File }>>([]);
  const uploadBusyRef = useRef(false);
  const uploadFetcherRef = useRef(uploadFetcher);
  useEffect(() => {
    uploadFetcherRef.current = uploadFetcher;
  });

  const lastUploadKeyRef = useRef<string | null>(null);
  const lastDeleteKeyRef = useRef<string | null>(null);
  const lastLabelKeyRef = useRef<string | null>(null);
  const lastCoverKeyRef = useRef<string | null>(null);
  const handledUploadDataRef = useRef<ActionData | undefined>(undefined);
  const handledDeleteDataRef = useRef<ActionData | undefined>(undefined);
  const lastDocumentsRef = useRef(documents);

  function kickUpload() {
    if (uploadBusyRef.current) return;
    if (uploadFetcherRef.current.state !== "idle") return;
    const next = queueRef.current.shift();
    if (!next) return;

    uploadBusyRef.current = true;
    const data = new FormData();
    data.set("intent", "upload");
    data.set("clientId", next.clientId);
    data.set("filename", next.file.name);
    data.set("file", next.file);
    void uploadFetcherRef.current.submit(data, {
      method: "post",
      encType: "multipart/form-data",
    });
  }

  // Sync server documents into the table; keep local uploading/error rows.
  useEffect(() => {
    if (lastDocumentsRef.current === documents) return;
    lastDocumentsRef.current = documents;
    setDocsById(
      new Map(documents.map((d) => [String(d.libraryDocumentId), d])),
    );
    setUploadFiles((prev) => {
      const serverItems = toUploadItems(documents);
      const serverNames = new Set(serverItems.map((f) => f.file.name));
      const local = prev.filter(
        (f) =>
          (f.status === "uploading" || f.status === "error") &&
          !serverNames.has(f.file.name),
      );
      return [...serverItems, ...local];
    });
  }, [documents]);

  // Handle upload result.
  useEffect(() => {
    if (uploadFetcher.state !== "idle" || !uploadFetcher.data) return;

    const key = JSON.stringify(uploadFetcher.data);
    if (lastUploadKeyRef.current === key) return;
    lastUploadKeyRef.current = key;
    handledUploadDataRef.current = uploadFetcher.data;

    uploadBusyRef.current = false;

    const data = handledUploadDataRef.current;
    if (data.ok && data.intent === "upload") {
      const doc = data.document;
      const clientId = data.clientId;
      setDocsById((prev) => {
        const next = new Map(prev);
        next.set(String(doc.libraryDocumentId), doc);
        return next;
      });
      setUploadFiles((prev) => {
        const withoutClient = prev.filter((f) => f.id !== clientId);
        const withoutDup = withoutClient.filter(
          (f) => f.libraryDocumentId !== doc.libraryDocumentId,
        );
        return [completedItem(doc), ...withoutDup];
      });
      toast.success(`Uploaded ${doc.filename}`);
      revalidator.revalidate();
      kickUpload();
      return;
    }

    if (!data.ok) {
      const clientId = data.clientId;
      if (clientId) {
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === clientId
              ? { ...f, status: "error" as const, error: data.error }
              : f,
          ),
        );
      }
      toast.error(data.error);
      kickUpload();
    }
  }, [uploadFetcher.state, uploadFetcher.data, revalidator]);

  useEffect(() => {
    if (deleteFetcher.state !== "idle" || !deleteFetcher.data) return;
    const key = JSON.stringify(deleteFetcher.data);
    if (lastDeleteKeyRef.current === key) return;
    lastDeleteKeyRef.current = key;
    handledDeleteDataRef.current = deleteFetcher.data;

    const data = handledDeleteDataRef.current;
    if (data.ok && data.intent === "delete") {
      toast.success("Document removed from the library");
      setPreviewDoc((current) =>
        current?.libraryDocumentId === data.id ? null : current,
      );
      setUploadFiles((prev) =>
        prev.filter((f) => f.libraryDocumentId !== data.id),
      );
      setDocsById((prev) => {
        const next = new Map(prev);
        next.delete(String(data.id));
        return next;
      });
      revalidator.revalidate();
      return;
    }
    if (!data.ok) toast.error(data.error);
  }, [deleteFetcher.state, deleteFetcher.data, revalidator]);

  useEffect(() => {
    if (labelFetcher.state !== "idle" || !labelFetcher.data) return;
    const key = JSON.stringify(labelFetcher.data);
    if (lastLabelKeyRef.current === key) return;
    lastLabelKeyRef.current = key;

    const data = labelFetcher.data;
    if (data.ok && data.intent === "update-label") {
      toast.success("Label updated");
      revalidator.revalidate();
      return;
    }
    if (!data.ok) {
      toast.error(data.error);
      revalidator.revalidate();
    }
  }, [labelFetcher.state, labelFetcher.data, revalidator]);

  useEffect(() => {
    if (coverFetcher.state !== "idle" || !coverFetcher.data) return;
    const key = JSON.stringify(coverFetcher.data);
    if (lastCoverKeyRef.current === key) return;
    lastCoverKeyRef.current = key;

    const data = coverFetcher.data;
    if (data.ok && data.intent === "update-cover-types") {
      toast.success("Cover types updated");
      revalidator.revalidate();
      return;
    }
    if (!data.ok) {
      toast.error(data.error);
    }
  }, [coverFetcher.state, coverFetcher.data, revalidator]);

  const [
    { isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      getInputProps,
    },
  ] = useFileUpload({
    maxFiles: MAX_FILES,
    maxSize: MAX_SIZE,
    accept: "application/pdf,.pdf",
    multiple: true,
    initialFiles: toMetadata(documents),
    onFilesAdded: (added) => {
      if (!canEdit) return;

      const jobs: Array<{ clientId: string; file: File }> = [];
      for (const item of added) {
        if (!(item.file instanceof File)) continue;
        jobs.push({ clientId: item.id, file: item.file });
      }
      if (jobs.length === 0) return;

      // Show rows immediately, then enqueue for upload.
      setUploadFiles((prev) => {
        const next = [...prev];
        for (const item of added) {
          if (!(item.file instanceof File)) continue;
          if (next.some((f) => f.id === item.id)) continue;
          next.unshift({ ...item, status: "uploading" });
        }
        return next;
      });
      queueRef.current.push(...jobs);
      kickUpload();
    },
  });

  const removeUploadFile = (fileId: string) => {
    const row = uploadFiles.find((f) => f.id === fileId);
    if (row?.libraryDocumentId != null) {
      const data = new FormData();
      data.set("intent", "delete");
      data.set("id", String(row.libraryDocumentId));
      void deleteFetcher.submit(data, { method: "post" });
      return;
    }
    queueRef.current = queueRef.current.filter((j) => j.clientId !== fileId);
    setUploadFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const deletingId = String(deleteFetcher.formData?.get("id") ?? "");
  const uploadingClientId = String(
    uploadFetcher.formData?.get("clientId") ?? "",
  );
  const labelBusy = labelFetcher.state !== "idle";
  const coverBusy = coverFetcher.state !== "idle";

  function startEditLabel(doc: LibraryDocumentRecord) {
    setEditingLabelId(doc.libraryDocumentId);
    setLabelDraft(doc.displayName);
  }

  function saveLabel(doc: LibraryDocumentRecord) {
    const displayName = normalizeDocumentLabel(labelDraft, doc.filename);
    setDocsById((prev) => {
      const next = new Map(prev);
      next.set(String(doc.libraryDocumentId), { ...doc, displayName });
      return next;
    });
    setEditingLabelId(null);
    setLabelDraft(displayName);

    const data = new FormData();
    data.set("intent", "update-label");
    data.set("id", String(doc.libraryDocumentId));
    data.set("label", displayName);
    void labelFetcher.submit(data, { method: "post" });
  }

  function openCoverTypesDialog(doc: LibraryDocumentRecord) {
    setCoverEditDoc(doc);
    setCoverDraftIds([...doc.coverTypeIds]);
  }

  function toggleCoverDraft(coverTypeId: number, checked: boolean) {
    setCoverDraftIds((prev) => {
      if (checked) {
        if (prev.includes(coverTypeId)) return prev;
        return [...prev, coverTypeId].sort((a, b) => a - b);
      }
      return prev.filter((id) => id !== coverTypeId);
    });
  }

  function saveCoverTypes() {
    if (!coverEditDoc) return;
    const data = new FormData();
    data.set("intent", "update-cover-types");
    data.set("id", String(coverEditDoc.libraryDocumentId));
    for (const coverTypeId of coverDraftIds) {
      data.append("coverTypeId", String(coverTypeId));
    }
    // Close immediately; table refreshes via revalidate on success.
    setCoverEditDoc(null);
    void coverFetcher.submit(data, { method: "post" });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {canEdit ? (
        <div
          className={cn(
            "relative rounded-lg border border-dashed p-6 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input {...getInputProps()} className="sr-only" />
          <div className="flex flex-col items-center gap-4">
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full bg-muted transition-colors",
                isDragging && "bg-primary/10",
              )}
            >
              <UploadIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                Drop PDFs here or{" "}
                <button
                  type="button"
                  onClick={openFileDialog}
                  className="cursor-pointer text-primary underline-offset-4 hover:underline"
                >
                  browse files
                </button>
              </p>
              <p className="text-xs text-muted-foreground">
                PDF only · max {formatBytes(MAX_SIZE)} · up to {MAX_FILES} files
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Alert>
          <CircleAlertIcon />
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>
            Only admins can upload, edit labels, cover types, or delete library
            documents.
          </AlertDescription>
        </Alert>
      )}

      {uploadFiles.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              Files ({uploadFiles.length})
            </h3>
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
                  const canPreview =
                    fileItem.status === "completed" && doc != null;
                  const isDeleting =
                    fileItem.libraryDocumentId != null &&
                    deletingId === String(fileItem.libraryDocumentId);
                  const isUploading =
                    fileItem.status === "uploading" ||
                    uploadingClientId === fileItem.id;
                  const isEditingLabel =
                    doc != null && editingLabelId === doc.libraryDocumentId;

                  return (
                    <TableRow
                      key={fileItem.id}
                      className={canPreview ? "cursor-pointer" : undefined}
                      onClick={() => {
                        if (canPreview && doc && !isEditingLabel) {
                          setPreviewDoc(doc);
                        }
                      }}
                    >
                      <TableCell className="py-2 ps-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 shrink-0 items-center justify-center text-red-600/90">
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
                      <TableCell
                        className="py-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {doc == null ? (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
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
                                  setEditingLabelId(null);
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
                              onClick={() => setEditingLabelId(null)}
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
                      </TableCell>
                      <TableCell
                        className="py-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {doc == null ? (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
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
                                    doc.coverTypeIds.includes(
                                      cover.coverTypeId,
                                    ),
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
                                title={coverTypeLabel(
                                  doc.coverTypeIds,
                                  coverTypes,
                                )}
                                onClick={() => openCoverTypesDialog(doc)}
                              >
                                <PencilIcon className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {formatBytes(fileItem.file.size)}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground tabular-nums">
                        {doc?.createdWhen ? formatDate(doc.createdWhen) : "—"}
                      </TableCell>
                      {canEdit ? (
                        <TableCell className="py-2">
                          <Button
                            onClick={(event) => {
                              event.stopPropagation();
                              removeUploadFile(fileItem.id);
                            }}
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={
                              fileItem.status === "uploading" || isDeleting
                            }
                            aria-label={`Delete ${fileItem.file.name}`}
                          >
                            {isDeleting ? (
                              <Spinner className="size-3.5" />
                            ) : (
                              <Trash2Icon className="size-3.5" />
                            )}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>File upload error(s)</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p key={error} className="last:mb-0">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <PdfPreviewDialog
        open={previewDoc != null}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
        title={previewDoc?.displayName ?? "Preview"}
        description={
          previewDoc
            ? `${previewDoc.filename} · ${formatBytes(previewDoc.sizeBytes)} · ${formatDate(previewDoc.createdWhen)}`
            : undefined
        }
        src={
          previewDoc
            ? libraryDocumentPublicPath(previewDoc.libraryDocumentId)
            : null
        }
      />

      <Dialog
        open={coverEditDoc != null}
        onOpenChange={(open) => {
          if (!open && !coverBusy) setCoverEditDoc(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!coverBusy}>
          <DialogHeader>
            <DialogTitle>Cover types</DialogTitle>
            <DialogDescription>
              Choose which cover types include{" "}
              <span className="font-medium text-foreground">
                {coverEditDoc?.displayName ?? "this document"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {coverTypes.map((cover) => {
              const checked = coverDraftIds.includes(cover.coverTypeId);
              const checkboxId = `cover-type-${cover.coverTypeId}`;
              return (
                <div
                  key={cover.coverTypeId}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    disabled={coverBusy}
                    onCheckedChange={(value) =>
                      toggleCoverDraft(cover.coverTypeId, value === true)
                    }
                  />
                  <Label htmlFor={checkboxId} className="cursor-pointer">
                    {cover.name}
                  </Label>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={coverBusy}
              onClick={() => setCoverEditDoc(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={coverBusy} onClick={saveCoverTypes}>
              {coverBusy ? (
                <>
                  <Spinner className="size-3.5" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
