import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import type { Template } from "@pdfme/common";
import { EditorSkeleton } from "~/components/documents/templates/loading";
import { MergePanel } from "~/components/documents/pdf/designer";
import { OverlayToolbar } from "~/components/documents/pdf/designer";
import { SelectionToolbar } from "~/components/documents/pdf/designer";
import { usePdfmeDesignerActions } from "~/hooks/pdfme-designer/use-actions";
import { usePdfmeDesignerLifecycle } from "~/hooks/pdfme-designer/use-lifecycle";
import {
  ENDORSEMENT_CONTENT_FIELD,
  ENDORSEMENT_SUBJECT_FIELD,
} from "~/lib/pdf/endorsement-expand";
import { PALETTE_MERGE_FIELD_NAMES } from "~/lib/pdf/pdf-sample-merge-inputs";
import { cn } from "~/lib/utils";

export type PdfmeDesignerHandle = {
  getTemplate: () => Template | null;
  updateTemplate: (template: Template) => void;
  addPage: () => void;
  setOrientation: (
    orientation: import("~/lib/pdf/templates").DocumentPageOrientation,
  ) => void;
  getOrientation: () => import("~/lib/pdf/templates").DocumentPageOrientation;
  addMergeField: (fieldName: string) => void;
};

type PdfmeDesignerProps = {
  ref?: React.Ref<PdfmeDesignerHandle>;
  template: Template;
  editable?: boolean;
  className?: string;
  onTemplateChange?: (template: Template) => void;
  toolbarHost?: HTMLElement | null;
};

export function MainDesigner({
  ref,
  template,
  editable = true,
  className,
  onTemplateChange,
  toolbarHost = null,
}: PdfmeDesignerProps) {
  const [yGapMm, setYGapMm] = useState("10");
  const [fieldQuery, setFieldQuery] = useState("");
  const [mergePanelOpen, setMergePanelOpen] = useState(false);

  const {
    containerRef,
    designerRef,
    onTemplateChangeRef,
    status,
    errorMessage,
    selected,
    setSelected,
    heightMm,
    setHeightMm,
    endorsementBlockGapMm,
    setEndorsementBlockGapMmState,
    tableColumns,
    setTableColumns,
    usedFieldNames,
    refreshUsedFields,
  } = usePdfmeDesignerLifecycle({
    template,
    editable,
    onTemplateChange,
  });

  const actions = usePdfmeDesignerActions({
    ref,
    designerRef,
    onTemplateChangeRef,
    editable,
    selected,
    setSelected,
    heightMm,
    yGapMm,
    endorsementBlockGapMm,
    setEndorsementBlockGapMmState,
    tableColumns,
    setTableColumns,
    usedFieldNames,
    refreshUsedFields,
  });

  const filteredFields = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase();
    if (!q) return PALETTE_MERGE_FIELD_NAMES;
    return PALETTE_MERGE_FIELD_NAMES.filter((name) =>
      name.toLowerCase().includes(q),
    );
  }, [fieldQuery]);

  const selectionCount = selected.length;
  const showToolbar = editable && status === "ready" && selectionCount > 0;
  const textSelected = selected.some(
    (item) => item.type === "text" || item.type === "multiVariableText",
  );
  const tableSelected = selectionCount === 1 && selected[0]?.type === "table";
  const endorsementPairSelected = selected.some((item) => {
    const base = String(item.name ?? "").replace(/__\d+$/, "");
    return (
      base === ENDORSEMENT_SUBJECT_FIELD || base === ENDORSEMENT_CONTENT_FIELD
    );
  });

  const toolbar = showToolbar ? (
    <SelectionToolbar
      selectionCount={selectionCount}
      textSelected={textSelected}
      tableSelected={tableSelected}
      endorsementPairSelected={endorsementPairSelected}
      heightMm={heightMm}
      yGapMm={yGapMm}
      endorsementBlockGapMm={endorsementBlockGapMm}
      tableColumns={tableColumns}
      onHeightMmChange={setHeightMm}
      onYGapMmChange={setYGapMm}
      onEndorsementBlockGapMmChange={setEndorsementBlockGapMmState}
      onBold={actions.handleBold}
      onTransparentBackground={actions.handleTransparentBackground}
      onZOrder={actions.handleZOrder}
      onSetHeight={actions.handleSetHeight}
      onSpaceVertically={actions.handleSpaceVertically}
      onSetEndorsementBlockGap={actions.handleSetEndorsementBlockGap}
      onTableColumnHeadChange={(index, value) => {
        setTableColumns((cols) =>
          cols.map((c, i) => (i === index ? { ...c, head: value } : c)),
        );
      }}
      onTableColumnWidthChange={(index, value) => {
        setTableColumns((cols) =>
          cols.map((c, i) => (i === index ? { ...c, widthPct: value } : c)),
        );
      }}
      onRemoveTableColumn={actions.handleRemoveTableColumn}
      onAddTableColumn={actions.handleAddTableColumn}
      onApplyTableColumns={actions.handleApplyTableColumns}
    />
  ) : null;

  return (
    <div className={cn("relative flex h-full min-h-0", className)}>
      {status === "loading" ? (
        <div className="absolute inset-0 z-10 bg-background">
          <EditorSkeleton className="h-full min-h-0 rounded-none border-0" />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background p-6 text-center text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {toolbarHost ? (
        createPortal(toolbar, toolbarHost)
      ) : toolbar ? (
        <OverlayToolbar>{toolbar}</OverlayToolbar>
      ) : null}

      {editable ? (
        <MergePanel
          editable={editable}
          status={status}
          mergePanelOpen={mergePanelOpen}
          onTogglePanel={() => setMergePanelOpen((open) => !open)}
          fieldQuery={fieldQuery}
          onFieldQueryChange={setFieldQuery}
          filteredFields={filteredFields}
          usedFieldNames={usedFieldNames}
          onAddMergeField={actions.addMergeField}
        />
      ) : null}

      <div ref={containerRef} className="min-w-0 flex-1" />
    </div>
  );
}
