import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import {
  CircleAlertIcon,
  CloudUploadIcon,
  FileTextIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PdfPreviewDialog } from "~/components/pdf-preview-dialog";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
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
import { cn, formatDate } from "~/lib/utils";
import {
  libraryDocumentPublicPath,
  type LibraryDocumentRecord,
} from "~/lib/library-documents";

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

export function LibraryDocumentsManager({
  documents,
  canEdit,
}: {
  documents: LibraryDocumentRecord[];
  canEdit: boolean;
}) {
  const revalidator = useRevalidator();
  const uploadFetcher = useFetcher<ActionData>();
  const deleteFetcher = useFetcher<ActionData>();

  const [uploadFiles, setUploadFiles] = useState<UploadItem[]>(() =>
    toUploadItems(documents),
  );
  const [previewDoc, setPreviewDoc] = useState<LibraryDocumentRecord | null>(
    null,
  );
  const [docsById, setDocsById] = useState(
    () => new Map(documents.map((d) => [String(d.libraryDocumentId), d])),
  );

  /** Upload queue — drained one-at-a-time via kickUpload. */
  const queueRef = useRef<Array<{ clientId: string; file: File }>>([]);
  const uploadBusyRef = useRef(false);
  const uploadFetcherRef = useRef(uploadFetcher);
  useEffect(() => {
    uploadFetcherRef.current = uploadFetcher;
  });

  const lastUploadKeyRef = useRef<string | null>(null);
  const lastDeleteKeyRef = useRef<string | null>(null);
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
            Only admins can upload or delete library documents.
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
                  <TableHead className="h-9 ps-4">Name</TableHead>
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

                  return (
                    <TableRow
                      key={fileItem.id}
                      className={canPreview ? "cursor-pointer" : undefined}
                      onClick={() => {
                        if (canPreview && doc) setPreviewDoc(doc);
                      }}
                    >
                      <TableCell className="py-2 ps-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 shrink-0 items-center justify-center text-muted-foreground/80">
                            {isUploading ? (
                              <Spinner className="size-4" />
                            ) : (
                              <FileTextIcon className="size-4" />
                            )}
                          </div>
                          <p className="truncate text-sm font-medium">
                            {fileItem.file.name}
                          </p>
                          {fileItem.status === "error" ? (
                            <Badge variant="destructive-light" size="sm">
                              Error
                            </Badge>
                          ) : null}
                        </div>
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
    </div>
  );
}
