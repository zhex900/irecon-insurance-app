import { useImperativeHandle, type Ref } from "react";
import type { Template } from "@pdfme/common";
import type { DesignerSelectedSchema } from "@pdfme/ui";
import type { PdfmeDesignerHandle } from "~/components/documents/pdf/designer";
import {
  createEndorsementsTableSchema,
  createTextMergeSchema,
  type DesignerInstance,
  nextFieldY,
  normalizeWidthPercentages,
  parseTableBodyRows,
  prepareDesignerTemplate,
  readTableColumns,
  type SchemaLike,
  type TableColumnDraft,
  toBulkRefs,
  uniqueSchemaName,
} from "~/components/documents/shared";
import {
  applyFontWeightToSchemas,
  applyHeightToSchemas,
  applyTransparentBackground,
  moveSchemasZOrder,
  spaceSchemasVertically,
} from "~/lib/pdf/bulk-format";
import {
  ENDORSEMENT_CONTENT_FIELD,
  ENDORSEMENT_SUBJECT_FIELD,
  readEndorsementBlockGapMm,
  setEndorsementBlockGapMm,
} from "~/lib/pdf/endorsement-expand";
import { ENDORSEMENTS_TABLE_FIELD } from "~/lib/pdf/merge-fields";
import {
  getTemplateOrientation,
  withPageOrientation,
  type DocumentPageOrientation,
} from "~/lib/pdf/templates";

export function usePdfmeDesignerActions({
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
}: {
  ref?: Ref<PdfmeDesignerHandle>;
  designerRef: React.RefObject<DesignerInstance | null>;
  onTemplateChangeRef: React.RefObject<
    ((template: Template) => void) | undefined
  >;
  editable: boolean;
  selected: DesignerSelectedSchema[];
  setSelected: React.Dispatch<React.SetStateAction<DesignerSelectedSchema[]>>;
  heightMm: string;
  yGapMm: string;
  endorsementBlockGapMm: string;
  setEndorsementBlockGapMmState: (value: string) => void;
  tableColumns: TableColumnDraft[];
  setTableColumns: React.Dispatch<React.SetStateAction<TableColumnDraft[]>>;
  usedFieldNames: Set<string>;
  refreshUsedFields: (template: Template) => void;
}) {
  function applyBulk(
    nextTemplate: Template,
    options?: { restoreSelection?: boolean },
  ) {
    const designer = designerRef.current;
    if (!designer) return;
    const restoreSelection = options?.restoreSelection ?? true;
    const targets = selected.map((schema) => ({
      name: schema.name,
      pageIndex: schema.pageIndex,
    }));
    designer.updateTemplate(nextTemplate);
    onTemplateChangeRef.current?.(nextTemplate);
    if (!restoreSelection) {
      setSelected([]);
      return;
    }
    window.setTimeout(() => {
      designer.selectSchemas(targets);
    }, 80);
  }

  function addMergeField(fieldName: string) {
    const designer = designerRef.current;
    if (!designer || !editable) return;
    const current = prepareDesignerTemplate(designer.getTemplate());
    const pageIndex = Math.min(
      Math.max(designer.getPageCursor?.() ?? 0, 0),
      Math.max(current.schemas.length - 1, 0),
    );
    const page = (current.schemas[pageIndex] ?? []) as SchemaLike[];
    const usedOnPage = new Set(
      page.map((schema) => schema.name).filter(Boolean) as string[],
    );
    const y = nextFieldY(page);

    const isEndorsementPair =
      fieldName === ENDORSEMENT_SUBJECT_FIELD ||
      fieldName === ENDORSEMENT_CONTENT_FIELD;
    if (isEndorsementPair) {
      const hasSubject = [...usedFieldNames].some(
        (n) => n === ENDORSEMENT_SUBJECT_FIELD,
      );
      const hasContent = [...usedFieldNames].some(
        (n) => n === ENDORSEMENT_CONTENT_FIELD,
      );
      if (hasSubject && hasContent) return;

      const toAdd: SchemaLike[] = [];
      if (!hasSubject) {
        toAdd.push(
          createTextMergeSchema(
            uniqueSchemaName(ENDORSEMENT_SUBJECT_FIELD, usedOnPage),
            y,
          ),
        );
      }
      if (!hasContent) {
        const contentY = toAdd[0]
          ? Number(toAdd[0].position?.y ?? y) + Number(toAdd[0].height ?? 6) + 2
          : y;
        toAdd.push(
          createTextMergeSchema(
            uniqueSchemaName(ENDORSEMENT_CONTENT_FIELD, usedOnPage),
            Number(contentY.toFixed(2)),
          ),
        );
      }

      const schemas = current.schemas.map((pageSchemas, index) =>
        index === pageIndex
          ? [
              ...pageSchemas,
              ...(toAdd as Template["schemas"][number][number][]),
            ]
          : [...pageSchemas],
      );
      const next = prepareDesignerTemplate({ ...current, schemas });
      designer.updateTemplate(next);
      onTemplateChangeRef.current?.(next);
      refreshUsedFields(next);
      setEndorsementBlockGapMmState(String(readEndorsementBlockGapMm(next)));
      window.setTimeout(() => {
        designer.selectSchemas(
          toAdd.map((schema) => ({
            name: String(schema.name),
            pageIndex,
          })),
        );
      }, 80);
      return;
    }

    const name = uniqueSchemaName(fieldName, usedOnPage);
    const schema =
      fieldName === ENDORSEMENTS_TABLE_FIELD
        ? createEndorsementsTableSchema(name, y)
        : createTextMergeSchema(name, y);

    const schemas = current.schemas.map((pageSchemas, index) =>
      index === pageIndex
        ? [...pageSchemas, schema as Template["schemas"][number][number]]
        : [...pageSchemas],
    );
    const next = prepareDesignerTemplate({ ...current, schemas });
    designer.updateTemplate(next);
    onTemplateChangeRef.current?.(next);
    refreshUsedFields(next);
    window.setTimeout(() => {
      designer.selectSchemas({ name, pageIndex });
    }, 80);
  }

  useImperativeHandle(ref, () => ({
    getTemplate: () => designerRef.current?.getTemplate() ?? null,
    updateTemplate: (next) => {
      const designer = designerRef.current;
      if (!designer) return;
      const prepared = prepareDesignerTemplate(next);
      designer.updateTemplate(prepared);
      onTemplateChangeRef.current?.(prepared);
      refreshUsedFields(prepared);
    },
    addPage: () => {
      const designer = designerRef.current;
      if (!designer || !editable) return;
      const current = prepareDesignerTemplate(designer.getTemplate());
      const pageCursor =
        designer.getPageCursor?.() ?? current.schemas.length - 1;
      const insertAt = Math.min(
        Math.max(pageCursor + 1, 0),
        current.schemas.length,
      );
      const schemas = current.schemas.map((page) => [...page]);
      schemas.splice(insertAt, 0, []);
      const next = prepareDesignerTemplate({ ...current, schemas });
      designer.updateTemplate(next);
      onTemplateChangeRef.current?.(next);
      setSelected([]);
    },
    getOrientation: () => {
      const current = designerRef.current?.getTemplate();
      return current ? getTemplateOrientation(current) : "portrait";
    },
    setOrientation: (orientation: DocumentPageOrientation) => {
      const designer = designerRef.current;
      if (!designer || !editable) return;
      const next = prepareDesignerTemplate(
        withPageOrientation(designer.getTemplate(), orientation),
      );
      designer.updateTemplate(next);
      onTemplateChangeRef.current?.(next);
    },
    addMergeField,
  }));

  function handleBold(bold: boolean) {
    const designer = designerRef.current;
    if (!designer || selected.length === 0) return;
    applyBulk(
      applyFontWeightToSchemas(
        designer.getTemplate(),
        toBulkRefs(selected),
        bold ? "700" : "400",
      ),
    );
  }

  function handleSetHeight() {
    const designer = designerRef.current;
    if (!designer || selected.length === 0) return;
    const height = Number(heightMm);
    if (!Number.isFinite(height) || height <= 0) return;
    applyBulk(
      applyHeightToSchemas(
        designer.getTemplate(),
        toBulkRefs(selected),
        height,
      ),
    );
  }

  function handleSpaceVertically() {
    const designer = designerRef.current;
    if (!designer || selected.length < 2) return;
    const yGap = Number(yGapMm);
    if (!Number.isFinite(yGap) || yGap < 0) return;
    applyBulk(
      spaceSchemasVertically(
        designer.getTemplate(),
        toBulkRefs(selected),
        yGap,
      ),
    );
  }

  function handleSetEndorsementBlockGap() {
    const designer = designerRef.current;
    if (!designer) return;
    const gap = Number(endorsementBlockGapMm);
    if (!Number.isFinite(gap) || gap < 0) return;
    const next = setEndorsementBlockGapMm(designer.getTemplate(), gap);
    applyBulk(next);
    setEndorsementBlockGapMmState(String(gap));
  }

  function handleZOrder(direction: "front" | "back" | "forward" | "backward") {
    const designer = designerRef.current;
    if (!designer || selected.length === 0) return;
    applyBulk(
      moveSchemasZOrder(
        designer.getTemplate(),
        toBulkRefs(selected),
        direction,
      ),
      { restoreSelection: false },
    );
  }

  function handleTransparentBackground() {
    const designer = designerRef.current;
    if (!designer || selected.length === 0) return;
    applyBulk(
      applyTransparentBackground(designer.getTemplate(), toBulkRefs(selected)),
    );
  }

  function mutateSelectedTable(
    mutate: (schema: Record<string, unknown>) => void,
  ) {
    const designer = designerRef.current;
    const target = selected[0];
    if (!designer || selected.length !== 1 || target?.type !== "table") return;
    const current = prepareDesignerTemplate(designer.getTemplate());
    const page = current.schemas[target.pageIndex];
    if (!page) return;
    let index = target.schemaIndex;
    if (
      index < 0 ||
      index >= page.length ||
      page[index]?.name !== target.name
    ) {
      index = page.findIndex((schema) => schema.name === target.name);
    }
    if (index < 0) return;

    const schemas = current.schemas.map((pageSchemas, pageIndex) => {
      if (pageIndex !== target.pageIndex) return pageSchemas.map((s) => s);
      return pageSchemas.map((schema, schemaIndex) => {
        if (schemaIndex !== index) return schema;
        const source = schema as SchemaLike;
        const next: SchemaLike = {
          ...source,
          head: Array.isArray(source.head) ? [...source.head] : [],
          headWidthPercentages: Array.isArray(source.headWidthPercentages)
            ? [...source.headWidthPercentages]
            : [],
        };
        mutate(next);
        return next as Template["schemas"][number][number];
      });
    });
    const nextTemplate = prepareDesignerTemplate({ ...current, schemas });
    applyBulk(nextTemplate);
    setTableColumns(readTableColumns(schemas[target.pageIndex]?.[index]));
  }

  function handleApplyTableColumns() {
    if (tableColumns.length === 0) return;
    const widths = normalizeWidthPercentages(
      tableColumns.map((col) => Number(col.widthPct)),
    );
    const heads = tableColumns.map(
      (col, i) => col.head.trim() || `Column ${i + 1}`,
    );
    mutateSelectedTable((schema) => {
      const prevCount = Array.isArray(schema.head) ? schema.head.length : 0;
      schema.head = heads;
      schema.headWidthPercentages = widths;
      const body = parseTableBodyRows(schema.content);
      schema.content = JSON.stringify(
        body.map((row) => {
          const next = heads.map((_, i) => row[i] ?? "");
          return next;
        }),
      );
      if (prevCount !== heads.length) {
        const styles = {
          ...((schema.columnStyles as Record<string, unknown> | undefined) ??
            {}),
        };
        schema.columnStyles = Object.fromEntries(
          heads.map((_, i) => [
            String(i),
            (styles[String(i)] as Record<string, unknown> | undefined) ?? {
              alignment: "left",
            },
          ]),
        );
      }
    });
  }

  function handleAddTableColumn() {
    setTableColumns((cols) => [
      ...cols,
      { head: `Column ${cols.length + 1}`, widthPct: "25" },
    ]);
  }

  function handleRemoveTableColumn(index: number) {
    setTableColumns((cols) => {
      if (cols.length <= 1) return cols;
      return cols.filter((_, i) => i !== index);
    });
  }

  return {
    addMergeField,
    handleBold,
    handleSetHeight,
    handleSpaceVertically,
    handleSetEndorsementBlockGap,
    handleZOrder,
    handleTransparentBackground,
    handleApplyTableColumns,
    handleAddTableColumn,
    handleRemoveTableColumn,
  };
}
