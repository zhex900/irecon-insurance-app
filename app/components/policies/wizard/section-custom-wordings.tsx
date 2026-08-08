import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { PlusIcon } from "lucide-react";
import { WordingHtmlView } from "~/components/policies/wording-html-view";
import { WordingRichEditor } from "~/components/policies/wording-rich-editor";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { FieldInput } from "~/components/ui/form-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";
import {
  createEmptyCustomWording,
  type CustomWordingItem,
} from "~/lib/policies/custom-wordings";
import {
  isWordingHtmlEmpty,
  normalizeWordingHtmlForSave,
  normalizeWordingSubjectForSave,
  plainTextFromWordingHtml,
} from "~/lib/policies/wording/html";

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
    setDraftSubject(plainTextFromWordingHtml(item.subject));
    setDraftContent(item.content);
    setDraftError(null);
  }

  function isDraftDirty() {
    return draftSubject.trim() !== "" || !isWordingHtmlEmpty(draftContent);
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
    const subject = normalizeWordingSubjectForSave(draftSubject);
    const content = normalizeWordingHtmlForSave(draftContent);
    if (isWordingHtmlEmpty(subject) && isWordingHtmlEmpty(content)) {
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
                    <Checkbox
                      checked
                      disabled
                      className="mt-0.5"
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
                        className="[&_input]:font-semibold"
                        placeholder="Endorsement title (always bold on schedules)"
                      />
                      <WordingRichEditor
                        label="Custom Wording Content"
                        variant="content"
                        value={draftContent}
                        onChange={(html) => {
                          setDraftContent(html);
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
                  <Checkbox
                    checked
                    disabled={mode !== "idle"}
                    onCheckedChange={(value) => {
                      if (value !== true) setDeleteId(item.id);
                    }}
                    className="mt-0.5"
                    aria-label={`Remove ${plainTextFromWordingHtml(item.subject) || "custom wording"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground">
                      {plainTextFromWordingHtml(item.subject) || "Untitled"}
                    </span>
                    {item.content ? (
                      <WordingHtmlView
                        html={item.content}
                        className="mt-1 text-xs text-muted-foreground"
                        clampLines={2}
                      />
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
                <Checkbox
                  checked
                  disabled
                  className="mt-0.5"
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
                    className="[&_input]:font-semibold"
                    placeholder="Endorsement title (always bold on schedules)"
                  />
                  <WordingRichEditor
                    label="Custom Wording Content"
                    variant="content"
                    value={draftContent}
                    onChange={(html) => {
                      setDraftContent(html);
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
                      {plainTextFromWordingHtml(deleteTarget?.subject ?? "") ||
                        "this wording"}
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
