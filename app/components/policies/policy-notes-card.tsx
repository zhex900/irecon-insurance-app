import { useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { UserHoverCard } from "~/components/ui/user-hover-card";
import { POLICY_MESSAGE_NOTE_TYPE_ID, type PolicyNote } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";
import { cn, formatRelativeTimeAgo } from "~/lib/utils";

function authorLabel(
  createdBy: string,
  authors: Record<string, NoteAuthor>,
): { text: string; author?: NoteAuthor } {
  const author = authors[createdBy.trim().toLowerCase()];
  if (!author) return { text: createdBy || "Unknown" };
  return { text: author.fullName, author };
}

function canEditNote(
  note: PolicyNote,
  canAddNotes: boolean,
  onUpdateNote?: (policyNoteId: number, description: string) => void,
) {
  return (
    canAddNotes &&
    Boolean(onUpdateNote) &&
    note.policyNoteTypeId === POLICY_MESSAGE_NOTE_TYPE_ID
  );
}

export function PolicyNotesCard({
  notes = [],
  noteAuthors = {},
  canAddNotes = false,
  onAddNote,
  onUpdateNote,
  noteBusy = false,
  noteError,
  className,
}: {
  notes?: PolicyNote[];
  noteAuthors?: Record<string, NoteAuthor>;
  canAddNotes?: boolean;
  onAddNote?: (description: string) => void;
  onUpdateNote?: (policyNoteId: number, description: string) => void;
  noteBusy?: boolean;
  noteError?: string | null;
  className?: string;
}) {
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const wasBusyRef = useRef(false);
  const pendingSaveRef = useRef<"add" | "edit" | null>(null);

  const selectedNote =
    selectedNoteId == null
      ? null
      : (notes.find((note) => note.policyNoteId === selectedNoteId) ?? null);

  useEffect(() => {
    if (wasBusyRef.current && !noteBusy && !noteError) {
      if (pendingSaveRef.current === "add") {
        setDraft("");
        setAddOpen(false);
      }
      if (pendingSaveRef.current === "edit") {
        setSelectedNoteId(null);
        setEditing(false);
      }
      pendingSaveRef.current = null;
      setLocalError(null);
    }
    wasBusyRef.current = noteBusy;
  }, [noteBusy, noteError]);

  function openNote(note: PolicyNote) {
    setLocalError(null);
    setEditDraft(note.description);
    setEditing(canEditNote(note, canAddNotes, onUpdateNote));
    setSelectedNoteId(note.policyNoteId);
  }

  function submitAdd() {
    const text = draft.trim();
    if (!text) {
      setLocalError("Enter a note before saving.");
      return;
    }
    setLocalError(null);
    pendingSaveRef.current = "add";
    onAddNote?.(text);
  }

  function submitEdit() {
    if (!selectedNote) return;
    const text = editDraft.trim();
    if (!text) {
      setLocalError("Enter a note before saving.");
      return;
    }
    setLocalError(null);
    pendingSaveRef.current = "edit";
    onUpdateNote?.(selectedNote.policyNoteId, text);
  }

  return (
    <>
      <Card
        size="sm"
        data-policy-notes
        className={cn(
          "flex h-fit max-h-full min-h-0 w-full flex-col gap-0 overflow-hidden",
          className,
        )}
      >
        <CardHeader className="shrink-0 border-b pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle>Policy Notes</CardTitle>
              <CardDescription>
                {notes.length === 0
                  ? "No notes yet"
                  : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
            {canAddNotes ? (
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Add policy note"
                disabled={noteBusy}
                onClick={() => {
                  setLocalError(null);
                  setAddOpen(true);
                }}
              >
                <PlusIcon />
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-0">
          {notes.length === 0 ? (
            <p className="px-(--card-spacing) py-3 text-xs text-muted-foreground">
              No notes yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {notes.map((note) => {
                const { text: authorText } = authorLabel(
                  note.createdBy,
                  noteAuthors,
                );
                return (
                  <li key={note.policyNoteId}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-1 px-(--card-spacing) py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                      onClick={() => openNote(note)}
                    >
                      <span className="line-clamp-2 text-sm text-foreground">
                        {note.description}
                      </span>
                      <span className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        <span className="truncate">
                          {formatRelativeTimeAgo(note.createdWhen)}
                        </span>
                        {authorText ? (
                          <span className="truncate">{authorText}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedNote != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNoteId(null);
            setEditing(false);
            setLocalError(null);
            pendingSaveRef.current = null;
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          {selectedNote ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Edit policy note" : "Policy note"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {editing ? "Edit this policy note" : "View this policy note"}
                </DialogDescription>
                <div className="text-sm text-muted-foreground">
                  <NoteMeta note={selectedNote} noteAuthors={noteAuthors} />
                </div>
              </DialogHeader>
              {editing ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={editDraft}
                    onChange={(event) => {
                      setEditDraft(event.target.value);
                      if (localError) setLocalError(null);
                    }}
                    rows={8}
                    aria-label="Edit policy note"
                    disabled={noteBusy}
                    className="min-h-40"
                    autoFocus
                  />
                  {localError || noteError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {localError || noteError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="max-h-[50vh] overflow-y-auto text-sm whitespace-pre-wrap text-foreground">
                  {selectedNote.description}
                </p>
              )}
              <DialogFooter>
                {editing ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={noteBusy}
                      onClick={() => {
                        setSelectedNoteId(null);
                        setEditing(false);
                        setLocalError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <LoadingButton
                      type="button"
                      loading={noteBusy}
                      loadingLabel="Saving…"
                      disabled={!editDraft.trim()}
                      onClick={submitEdit}
                    >
                      Save
                    </LoadingButton>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedNoteId(null)}
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setDraft("");
            setLocalError(null);
            pendingSaveRef.current = null;
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add policy note</DialogTitle>
            <DialogDescription>
              Saved against this policy for the broker team.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (localError) setLocalError(null);
              }}
              rows={6}
              placeholder="Write a note…"
              aria-label="New policy note"
              disabled={noteBusy}
              className="min-h-32"
              autoFocus
            />
            {localError || noteError ? (
              <p className="text-sm text-destructive" role="alert">
                {localError || noteError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={noteBusy}
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              loading={noteBusy}
              loadingLabel="Saving…"
              disabled={!draft.trim()}
              onClick={submitAdd}
            >
              Add note
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NoteMeta({
  note,
  noteAuthors,
}: {
  note: PolicyNote;
  noteAuthors: Record<string, NoteAuthor>;
}) {
  const { text, author } = authorLabel(note.createdBy, noteAuthors);
  return (
    <span className="flex flex-col gap-0.5">
      <span>{formatRelativeTimeAgo(note.createdWhen)}</span>
      {text ? (
        author ? (
          <UserHoverCard user={author}>{author.fullName}</UserHoverCard>
        ) : (
          <span>{text}</span>
        )
      ) : null}
    </span>
  );
}
