import { useCallback, useRef } from "react";
import type { Template } from "@pdfme/common";
import {
  EditableTitle,
  TemplateVersionBadges,
  EditorToolbar,
} from "~/components/documents/templates/editor";
import { MainDesigner, type PdfmeDesignerHandle } from "~/components/documents/pdf/designer";
import { DeleteDialog, TemplateConfirmDialog, LeaveDialog } from "~/components/documents/templates/dialogs";
import { HistorySheet } from "~/components/documents/templates/history";
import { PreviewDialog } from "~/components/documents/pdf/preview";
import { PageHeader } from "~/components/layout/app-layout";
import { useDocumentTemplateEditorController } from "~/hooks/document-template-editor/use-controller";
import { useDocumentTemplatePreview } from "~/hooks/use-document-template-preview";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import type { DocumentTemplateEditorLoaderData } from "~/lib/documents/template-editor-types";

export function MainEditor({
  loaderData,
}: {
  loaderData: DocumentTemplateEditorLoaderData;
}) {
  const designerRef = useRef<PdfmeDesignerHandle>(null);
  const { template: docTemplate } = loaderData;

  const {
    previewOpen,
    previewSrc,
    previewLoading,
    previewError,
    previewTitle,
    setPreviewOpen,
    closePreview,
    generatePreview,
    fetchHistoryVersionTemplate,
  } = useDocumentTemplatePreview(docTemplate);

  const loadHistoryVersion = useCallback(
    (versionNumber: number) =>
      fetchHistoryVersionTemplate(docTemplate.key, versionNumber),
    [docTemplate.key, fetchHistoryVersionTemplate],
  );

  const previewTemplate = useCallback(
    (template: Template, title: string) => generatePreview(template, title),
    [generatePreview],
  );

  const editor = useDocumentTemplateEditorController({
    loaderData,
    designerRef,
    fetchHistoryVersionTemplate: loadHistoryVersion,
    onPreviewTemplate: previewTemplate,
  });

  const displayTitle = formatDocumentTemplateTitle(docTemplate.title);

  return (
    <div className="flex h-[calc(100svh-3.5rem-2rem)] flex-col gap-4 md:h-[calc(100svh-3.5rem-4rem)]">
      <div className="shrink-0 [&>*]:mb-0">
        <PageHeader
          title={
            <EditableTitle
              displayTitle={formatDocumentTemplateTitle(editor.titleValue)}
              value={editor.titleValue}
              canEdit={editor.canEdit}
              busy={editor.busy}
              onChange={editor.setTitleValue}
              onSave={(next) => {
                editor.setTitleValue(next);
                editor.setEditingTitle(false);
                editor.submitMeta({ title: next });
              }}
              onCancel={() => {
                editor.setTitleValue(docTemplate.title);
                editor.setEditingTitle(false);
              }}
              editing={editor.editingTitle}
              onEditingChange={editor.setEditingTitle}
            />
          }
          titleAddon={
            <TemplateVersionBadges
              publishedVersionNumber={loaderData.publishedVersionNumber}
              editingVersionNumber={loaderData.editingVersionNumber}
              editingIsPublished={loaderData.editingIsPublished}
              unsavedCount={editor.dirty ? editor.unsavedChanges.length : 0}
              autosaveStatus={editor.autosaveStatus}
            />
          }
          breadcrumbs={[
            { label: "Settings", to: "/settings" },
            { label: "Document Templates", to: "/settings/document-templates" },
            { label: displayTitle },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <EditorToolbar
          editable={editor.canEdit}
          deletable={editor.canDelete}
          busy={editor.busy}
          previewLoading={previewLoading}
          canUndo={loaderData.canUndo}
          canRevert={editor.canRevert}
          intent={editor.intent}
          templateKey={docTemplate.key}
          savedLabel={docTemplate.label}
          label={editor.labelValue}
          coverType={editor.coverTypeValue}
          orientation={editor.orientation}
          onLabelChange={editor.setLabelValue}
          onSaveLabel={(next: string) => {
            if (next === docTemplate.label) return;
            editor.setLabelValue(next);
            editor.submitMeta({ label: next });
          }}
          onCoverTypeChange={(next: string) => {
            editor.setCoverTypeValue(next);
            editor.submitMeta({ coverTypeId: next });
          }}
          onBack={editor.requestLeaveToList}
          onPreview={() => void editor.handlePreview()}
          onAddPage={() => designerRef.current?.addPage()}
          onOrientationChange={editor.handleOrientation}
          onHistory={() => editor.setHistoryOpen(true)}
          onUndo={editor.handleUndo}
          onDelete={editor.handleReset}
          onRevert={editor.handleRevertChanges}
          onSaveDraft={() => editor.submitTemplate("draft")}
          onPublish={() => editor.submitTemplate("publish")}
        />

        <MainDesigner
          key={docTemplate.key}
          ref={designerRef}
          template={docTemplate.template as Template}
          editable={editor.canEdit}
          onTemplateChange={editor.handleTemplateChange}
          className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-background"
        />
      </div>

      <HistorySheet
        open={editor.historyOpen}
        onOpenChange={editor.setHistoryOpen}
        versions={loaderData.history}
        publishedVersionNumber={loaderData.publishedVersionNumber}
        canEdit={editor.canEdit}
        busy={editor.busy}
        dirty={editor.dirty}
        unsavedChanges={editor.unsavedChanges}
        editorName={loaderData.viewerName}
        basedOnVersion={loaderData.editingVersionNumber}
        onPreviewVersion={(entry: import("~/lib/services/documents/document-template-history").DocumentTemplateHistoryEntry) => void editor.handlePreviewVersion(entry)}
        onPublishVersion={editor.publishVersion}
        onDeleteDraft={editor.deleteDraft}
        onOpenInEditor={editor.handleOpenVersionInEditor}
        onPreviewWorkingCopy={() => void editor.handlePreview()}
        onSaveDraft={() => editor.submitTemplate("draft")}
      />

      <LeaveDialog
        open={editor.leaveOpen}
        changes={editor.unsavedChanges}
        saving={
          editor.busy &&
          editor.intent === "draft" &&
          editor.pendingLeaveAfterSave
        }
        onStay={editor.cancelLeave}
        onDiscard={editor.discardLeave}
        onSaveAndLeave={() => {
          editor.dispatch({ type: "request_leave_after_save" });
          editor.submitTemplate("draft");
        }}
      />

      {editor.canDelete ? (
        <DeleteDialog
          open={editor.deleteOpen}
          title={displayTitle}
          deleting={editor.busy && editor.intent === "reset"}
          onOpenChange={editor.setDeleteOpen}
          onConfirm={editor.confirmDelete}
        />
      ) : null}

      <TemplateConfirmDialog
        action={editor.confirmAction}
        busy={editor.busy}
        intent={editor.intent}
        onOpenChange={(open: boolean) => {
          if (!open) editor.setConfirmAction(null);
        }}
        onConfirm={editor.resolveConfirmAction}
      />

      <PreviewDialog
        open={previewOpen}
        onOpenChange={(open: boolean) => {
          setPreviewOpen(open);
          if (!open) closePreview();
        }}
        title={`${previewTitle} — preview`}
        description="Generated with sample policy data (not a real policy)."
        src={previewSrc}
        loading={previewLoading}
        error={previewError}
      />
    </div>
  );
}
