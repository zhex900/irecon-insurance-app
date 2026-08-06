import { useState } from "react";
import {
  ChevronDownIcon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import type { TemplateChange } from "~/lib/pdf/template-changelog";
import type { DocumentTemplateHistoryEntry } from "~/lib/services/documents/document-template-history";
import { cn, formatDate, formatRelativeTimeAgo } from "~/lib/utils";

type HistoryTab = "current" | "drafts" | "published";

export function DocumentTemplateHistorySheet({
  open,
  onOpenChange,
  versions,
  publishedVersionNumber,
  canEdit,
  busy,
  dirty,
  unsavedChanges,
  editorName,
  basedOnVersion,
  onPreviewVersion,
  onPublishVersion,
  onDeleteDraft,
  onOpenInEditor,
  onPreviewWorkingCopy,
  onSaveDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: DocumentTemplateHistoryEntry[];
  publishedVersionNumber: number | null;
  canEdit: boolean;
  busy: boolean;
  dirty: boolean;
  unsavedChanges: TemplateChange[];
  editorName: string;
  basedOnVersion: number | null;
  onPreviewVersion: (entry: DocumentTemplateHistoryEntry) => void;
  onPublishVersion: (versionNumber: number) => void;
  onDeleteDraft: (versionNumber: number) => void;
  onOpenInEditor: (entry: DocumentTemplateHistoryEntry) => void;
  onPreviewWorkingCopy: () => void;
  onSaveDraft: () => void;
}) {
  const [tab, setTab] = useState<HistoryTab>("drafts");
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  // Live flag is only on the current published row. Treat version numbers at or
  // below the live version as published history; newer unpublished rows as drafts.
  const draftRows = versions.filter((v) => {
    if (v.isPublished) return false;
    if (publishedVersionNumber == null) return true;
    return v.versionNumber > publishedVersionNumber;
  });
  const publishedRows = versions.filter((v) => {
    if (v.isPublished) return true;
    if (publishedVersionNumber == null) return false;
    return v.versionNumber <= publishedVersionNumber;
  });

  const rows =
    tab === "drafts" ? draftRows : tab === "published" ? publishedRows : [];

  function selectTab(next: HistoryTab) {
    setTab(next);
    setExpandedVersion(null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-lg"
        showCloseButton
      >
        <SheetHeader className="border-b">
          <SheetTitle>History</SheetTitle>
          <SheetDescription>
            Current edit, saved drafts, and published versions with changelog.
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-2 border-b px-4 py-3">
          <TabButton
            active={tab === "current"}
            onClick={() => selectTab("current")}
          >
            Current edit
          </TabButton>
          <TabButton
            active={tab === "drafts"}
            onClick={() => selectTab("drafts")}
          >
            Drafts ({draftRows.length})
          </TabButton>
          <TabButton
            active={tab === "published"}
            onClick={() => selectTab("published")}
          >
            Published ({publishedRows.length})
          </TabButton>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          onScroll={() => {
            if (expandedVersion != null) setExpandedVersion(null);
          }}
        >
          {tab === "current" ? (
            <CurrentEditPanel
              dirty={dirty}
              changes={unsavedChanges}
              editorName={editorName}
              basedOnVersion={basedOnVersion}
              canEdit={canEdit}
              busy={busy}
              onPreview={onPreviewWorkingCopy}
              onSaveDraft={onSaveDraft}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No {tab} versions yet.
                </p>
              ) : (
                rows.map((entry) => (
                  <VersionCard
                    key={entry.versionNumber}
                    entry={entry}
                    isLive={
                      entry.isPublished ||
                      entry.versionNumber === publishedVersionNumber
                    }
                    isDraftTab={tab === "drafts"}
                    canDeleteDraft={canEdit && versions.length > 1}
                    canEdit={canEdit}
                    busy={busy}
                    expanded={expandedVersion === entry.versionNumber}
                    onToggleExpand={() =>
                      setExpandedVersion((current) =>
                        current === entry.versionNumber
                          ? null
                          : entry.versionNumber,
                      )
                    }
                    onPreview={() => onPreviewVersion(entry)}
                    onOpenInEditor={() => onOpenInEditor(entry)}
                    onPublish={() => onPublishVersion(entry.versionNumber)}
                    onDeleteDraft={() => onDeleteDraft(entry.versionNumber)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CurrentEditPanel({
  dirty,
  changes,
  editorName,
  basedOnVersion,
  canEdit,
  busy,
  onPreview,
  onSaveDraft,
}: {
  dirty: boolean;
  changes: TemplateChange[];
  editorName: string;
  basedOnVersion: number | null;
  canEdit: boolean;
  busy: boolean;
  onPreview: () => void;
  onSaveDraft: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Status"
          value={dirty ? `Unsaved · ${changes.length}` : "In sync with draft"}
        />
        <Stat
          label="Based on"
          value={
            basedOnVersion != null ? `Draft v${basedOnVersion}` : "No draft"
          }
        />
        <Stat label="Editor" value={editorName} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Unsaved changelog</h3>
        {dirty && changes.length > 0 ? (
          <ChangelogList items={changes} />
        ) : (
          <p className="text-sm text-muted-foreground">No unsaved changes.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onPreview}
        >
          <EyeIcon data-icon="inline-start" />
          Preview working copy
        </Button>
        {canEdit ? (
          <LoadingButton
            type="button"
            size="sm"
            loading={busy}
            loadingLabel="Saving…"
            disabled={!dirty}
            onClick={onSaveDraft}
          >
            Save draft
          </LoadingButton>
        ) : null}
      </div>
    </div>
  );
}

function VersionCard({
  entry,
  isLive,
  isDraftTab,
  canDeleteDraft,
  canEdit,
  busy,
  expanded,
  onToggleExpand,
  onPreview,
  onOpenInEditor,
  onPublish,
  onDeleteDraft,
}: {
  entry: DocumentTemplateHistoryEntry;
  isLive: boolean;
  isDraftTab: boolean;
  canDeleteDraft: boolean;
  canEdit: boolean;
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onPreview: () => void;
  onOpenInEditor: () => void;
  onPublish: () => void;
  onDeleteDraft: () => void;
}) {
  const changeCount = entry.changes.length;

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        className="flex w-full items-start gap-2 p-3 text-left"
        aria-expanded={expanded}
        onClick={onToggleExpand}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">
              v{entry.versionNumber}
            </span>
            {isLive ? (
              <Badge variant="success-light" size="sm" radius="full">
                Live
              </Badge>
            ) : entry.isPublished ? (
              <Badge variant="success-light" size="sm" radius="full">
                Published
              </Badge>
            ) : (
              <Badge variant="warning-light" size="sm" radius="full">
                Draft
              </Badge>
            )}
            <Badge variant="info-light" size="sm" radius="full">
              {changeCount} change{changeCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mt-1.5 text-xs whitespace-nowrap text-muted-foreground">
            {entry.authorName}
            {entry.createdWhen
              ? ` · ${formatRelativeTimeAgo(entry.createdWhen)} · ${formatDate(entry.createdWhen)}`
              : null}
          </p>
        </div>
        <ChevronDownIcon
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded ? (
        <div className="border-t px-3 pt-3 pb-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onPreview}
            >
              <EyeIcon data-icon="inline-start" />
              Preview
            </Button>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onOpenInEditor}
              >
                <PencilIcon data-icon="inline-start" />
                Open in editor
              </Button>
            ) : null}
            {canEdit ? (
              isLive ? (
                <Button type="button" variant="ghost" size="sm" disabled>
                  Current live
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={onPublish}
                >
                  <UploadIcon data-icon="inline-start" />
                  Set as published
                </Button>
              )
            ) : null}
            {canDeleteDraft && isDraftTab && !isLive ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={onDeleteDraft}
              >
                <Trash2Icon data-icon="inline-start" />
                Delete draft
              </Button>
            ) : null}
          </div>
          {changeCount > 0 ? (
            <ChangelogList items={entry.changes} />
          ) : (
            <p className="text-sm text-muted-foreground">No changelog items.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ChangelogList({ items }: { items: TemplateChange[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((change) => (
        <li
          key={`${change.kind}-${change.label}`}
          className="flex items-start gap-2 text-sm"
        >
          <ChangeKindBadge kind={change.kind} />
          <span className="min-w-0 flex-1">{change.label}</span>
        </li>
      ))}
    </ul>
  );
}

function ChangeKindBadge({ kind }: { kind: TemplateChange["kind"] }) {
  const variant =
    kind === "added"
      ? "success-light"
      : kind === "removed"
        ? "destructive-light"
        : kind === "changed"
          ? "warning-light"
          : "info-light";
  return (
    <Badge variant={variant} size="sm" className="shrink-0 capitalize">
      {kind}
    </Badge>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
