import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { PlusIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FieldInput, FieldTextarea } from "~/components/ui/form-controls";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";
import {
  createEmptyCustomWording,
  type CustomWordingItem,
} from "~/lib/custom-wordings";

export function CustomWordingsEditor() {
  const { control } = useFormContext<CarPolicyFormValues>();
  const [mode, setMode] = useState<"idle" | "adding" | "editing">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);

  function resetDraft() {
    setMode("idle");
    setEditingId(null);
    setDraftSubject("");
    setDraftContent("");
    setDraftError(null);
    setPendingCancel(false);
  }

  function startAdd() {
    setMode("adding");
    setEditingId(null);
    setDraftSubject("");
    setDraftContent("");
    setDraftError(null);
  }

  function startEdit(item: CustomWordingItem) {
    setMode("editing");
    setEditingId(item.id);
    setDraftSubject(item.subject);
    setDraftContent(item.content);
    setDraftError(null);
  }

  function isDraftDirty() {
    return draftSubject.trim() !== "" || draftContent.trim() !== "";
  }

  function requestCancel() {
    if (mode === "editing" || isDraftDirty()) {
      setPendingCancel(true);
      return;
    }
    resetDraft();
  }

  function saveItem(
    items: CustomWordingItem[],
    onChange: (next: CustomWordingItem[]) => void,
    existingId?: string,
  ) {
    const subject = draftSubject.trim();
    const content = draftContent.trim();
    if (!subject && !content) {
      setDraftError("Enter a subject or content before saving.");
      return;
    }
    if (existingId) {
      onChange(
        items.map((row) =>
          row.id === existingId ? { ...row, subject, content } : row,
        ),
      );
    } else {
      const next = createEmptyCustomWording();
      next.subject = subject;
      next.content = content;
      onChange([...items, next]);
    }
    resetDraft();
  }

  return (
    <Controller
      control={control}
      name="customWordings"
      render={({ field }) => {
        const items = field.value ?? [];

        function confirmDelete() {
          if (!deleteId) return;
          field.onChange(items.filter((item) => item.id !== deleteId));
          if (editingId === deleteId) resetDraft();
          setDeleteId(null);
        }

        const deleteTarget = items.find((item) => item.id === deleteId);

        return (
          <>
            {items.map((item) => {
              const isEditing = mode === "editing" && editingId === item.id;
              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-md border border-border p-3 text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked
                      readOnly
                      className="mt-1"
                      aria-label="Custom wording"
                    />
                    <div className="flex w-full flex-col gap-3">
                      <FieldInput
                        label="Custom Wording Subject"
                        value={draftSubject}
                        onChange={(e) => {
                          setDraftSubject(e.target.value);
                          setDraftError(null);
                        }}
                      />
                      <FieldTextarea
                        label="Custom Wording Content"
                        rows={4}
                        value={draftContent}
                        onChange={(e) => {
                          setDraftContent(e.target.value);
                          setDraftError(null);
                        }}
                      />
                      {draftError ? (
                        <p className="text-sm text-destructive" role="alert">
                          {draftError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            saveItem(items, field.onChange, item.id)
                          }
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={requestCancel}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteId(item.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border border-border p-3 text-foreground"
                >
                  <input
                    type="checkbox"
                    checked
                    className="mt-1"
                    disabled={mode !== "idle"}
                    onChange={() => setDeleteId(item.id)}
                    aria-label={`Remove ${item.subject || "custom wording"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">
                      {item.subject || "Untitled"}
                    </span>
                    {item.content ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.content}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={mode !== "idle"}
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={mode !== "idle"}
                        onClick={() => setDeleteId(item.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {mode === "adding" ? (
              <div className="flex items-start gap-3 rounded-md border border-border p-3 text-foreground">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="mt-1"
                  aria-label="New custom wording"
                />
                <div className="flex w-full flex-col gap-3">
                  <FieldInput
                    label="Custom Wording Subject"
                    value={draftSubject}
                    onChange={(e) => {
                      setDraftSubject(e.target.value);
                      setDraftError(null);
                    }}
                  />
                  <FieldTextarea
                    label="Custom Wording Content"
                    rows={4}
                    value={draftContent}
                    onChange={(e) => {
                      setDraftContent(e.target.value);
                      setDraftError(null);
                    }}
                  />
                  {draftError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {draftError}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveItem(items, field.onChange)}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={requestCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {mode === "idle" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={startAdd}
              >
                <PlusIcon />
                Add custom wording
              </Button>
            ) : null}

            <Dialog
              open={deleteId != null}
              onOpenChange={(open) => {
                if (!open) setDeleteId(null);
              }}
            >
              <DialogContent className="sm:max-w-md" showCloseButton>
                <DialogHeader>
                  <DialogTitle>Delete custom wording?</DialogTitle>
                  <DialogDescription>
                    This removes{" "}
                    <span className="font-medium text-foreground">
                      {deleteTarget?.subject || "this wording"}
                    </span>
                    . This cannot be undone from here.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={confirmDelete}
                  >
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={pendingCancel}
              onOpenChange={(open) => {
                if (!open) setPendingCancel(false);
              }}
            >
              <DialogContent className="sm:max-w-md" showCloseButton>
                <DialogHeader>
                  <DialogTitle>Discard changes?</DialogTitle>
                  <DialogDescription>
                    Subject and content edits will be lost.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPendingCancel(false)}
                  >
                    Keep editing
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={resetDraft}
                  >
                    Discard
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        );
      }}
    />
  );
}
