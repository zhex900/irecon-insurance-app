import { CircleAlertIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { toast } from "sonner";

import { CoverTypesDialog } from "~/components/documents/library/dialogs";
import { LibraryTable } from "~/components/documents/library/table";
import { PreviewDialog } from "~/components/documents/pdf/preview";
import {
  completedItem,
  type CoverTypeOption,
  type LibraryDocumentActionData,
  MAX_FILES,
  MAX_SIZE,
  toUploadItems,
  type UploadItem,
} from "~/components/documents/shared";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { formatBytes } from "~/hooks/utilities";
import {
  type FileWithPreview,
  useFileUploadFixed,
} from "~/hooks/utilities/use-file-upload-fixed";
import { normalizeDocumentLabel } from "~/lib/documents/document-label";
import {
  libraryDocumentPublicPath,
  type LibraryDocumentRecord,
} from "~/lib/documents/library-documents";
import { cn, formatDate } from "~/lib/utils";

export function LibraryManager({
  documents,
  coverTypes,
  canEdit,
}: {
  documents: LibraryDocumentRecord[];
  coverTypes: CoverTypeOption[];
  canEdit: boolean;
}) {
  const revalidator = useRevalidator();
  const uploadFetcher = useFetcher<LibraryDocumentActionData>();
  const deleteFetcher = useFetcher<LibraryDocumentActionData>();
  const labelFetcher = useFetcher<LibraryDocumentActionData>();
  const coverFetcher = useFetcher<LibraryDocumentActionData>();

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
  const handledUploadDataRef = useRef<LibraryDocumentActionData | undefined>(
    undefined,
  );
  const handledDeleteDataRef = useRef<LibraryDocumentActionData | undefined>(
    undefined,
  );

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

  const {
    isDragging,
    errors,
    openFileDialog,
    getInputProps,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useFileUploadFixed({
    maxFiles: MAX_FILES,
    maxSize: MAX_SIZE,
    accept: "application/pdf,.pdf",
    multiple: true,
    onFilesAdded: (added: FileWithPreview[]) => {
      if (!canEdit) return;

      const jobs: Array<{ clientId: string; file: File }> = [];
      for (const item of added) {
        jobs.push({ clientId: item.id, file: item.file });
      }
      if (jobs.length === 0) return;

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

      <LibraryTable
        files={uploadFiles}
        documentsById={docsById}
        coverTypes={coverTypes}
        canEdit={canEdit}
        deletingId={deletingId}
        uploadingClientId={uploadingClientId}
        editingLabelId={editingLabelId}
        labelDraft={labelDraft}
        labelBusy={labelBusy}
        onPreview={setPreviewDoc}
        onLabelDraftChange={setLabelDraft}
        onStartEditLabel={startEditLabel}
        onCancelEditLabel={() => setEditingLabelId(null)}
        onSaveLabel={saveLabel}
        onEditCoverTypes={openCoverTypesDialog}
        onDelete={removeUploadFile}
        onAddFiles={openFileDialog}
      />
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

      <PreviewDialog
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

      <CoverTypesDialog
        document={coverEditDoc}
        coverTypes={coverTypes}
        selectedIds={coverDraftIds}
        busy={coverBusy}
        onOpenChange={(open) => {
          if (!open && !coverBusy) setCoverEditDoc(null);
        }}
        onToggle={toggleCoverDraft}
        onCancel={() => setCoverEditDoc(null)}
        onSave={saveCoverTypes}
      />
    </div>
  );
}
