import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Template } from "@pdfme/common";
import type { DesignerSelectedSchema, DesignerSelection } from "@pdfme/ui";
import {
  BoldIcon,
  BracesIcon,
  BringToFrontIcon,
  Columns3Icon,
  DropletOffIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  SendToBackIcon,
  UnfoldVerticalIcon,
} from "lucide-react";
import { DocumentTemplatesEditorSkeleton } from "~/components/settings/document-templates-loading";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  applyFontWeightToSchemas,
  applyHeightToSchemas,
  applyTransparentBackground,
  moveSchemasZOrder,
  spaceSchemasVertically,
  type BulkSchemaRef,
} from "~/lib/pdf/bulk-format";
import {
  DEFAULT_ENDORSEMENT_BLOCK_GAP_MM,
  ENDORSEMENT_BLOCK_GAP_KEY,
  ENDORSEMENT_CONTENT_FIELD,
  ENDORSEMENT_SUBJECT_FIELD,
  readEndorsementBlockGapMm,
  setEndorsementBlockGapMm,
} from "~/lib/pdf/endorsement-expand";
import {
  ENDORSEMENTS_TABLE_FIELD,
  endorsementsTableContent,
  estimateTableHeightMm,
} from "~/lib/pdf/merge-fields";
import { getPdfmeFonts, resolvePdfmeFontName } from "~/lib/pdf/fonts";
import { pdfmePlugins } from "~/lib/pdf/plugins";
import { PALETTE_MERGE_FIELD_NAMES } from "~/lib/pdf/sample-merge-inputs";
import {
  getTemplateOrientation,
  withBlankPageBackground,
  withPageOrientation,
  type DocumentPageOrientation,
} from "~/lib/pdf/templates";
import { cn } from "~/lib/utils";

export type PdfmeDesignerHandle = {
  getTemplate: () => Template | null;
  updateTemplate: (template: Template) => void;
  /** Insert a blank page after the current page. */
  addPage: () => void;
  /** Switch blank A4 canvas between portrait and landscape. */
  setOrientation: (orientation: DocumentPageOrientation) => void;
  getOrientation: () => DocumentPageOrientation;
  /** Insert a merge field schema onto the current page. */
  addMergeField: (fieldName: string) => void;
};

type PdfmeDesignerProps = {
  ref?: React.Ref<PdfmeDesignerHandle>;
  template: Template;
  editable?: boolean;
  className?: string;
  /** Fires when the designer template changes (move/edit/add/remove). */
  onTemplateChange?: (template: Template) => void;
  /**
   * Host element for the field formatting toolbar (e.g. header slot left of
   * Publish). When set, the toolbar is inlined there instead of floating.
   */
  toolbarHost?: HTMLElement | null;
};

type SchemaLike = {
  name?: string;
  type?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  content?: string;
  [key: string]: unknown;
};

type DesignerInstance = {
  getTemplate: () => Template;
  updateTemplate: (template: Template) => void;
  destroy: () => void;
  onChangeTemplate: (cb: (template: Template) => void) => void;
  onChangeSelection: (cb: (selection: DesignerSelection) => void) => void;
  getSelection: () => DesignerSelection;
  getPageCursor: () => number;
  getTotalPages: () => number;
  selectSchemas: (
    targets:
      | { name?: string; pageIndex?: number; schemaId?: string }
      | Array<{ name?: string; pageIndex?: number; schemaId?: string }>,
  ) => void;
};

/** Fill empty text schemas with sample content for Designer preview. */
function withPreviewContent(template: Template): Template {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((schema) => {
        if (schema.type !== "text" && schema.type !== "multiVariableText") {
          return schema;
        }
        const content =
          typeof schema.content === "string" ? schema.content.trim() : "";
        if (content) return schema;
        return {
          ...schema,
          content: schema.name || "Text",
        };
      }),
    ),
  };
}

/** Ensure table schemas (esp. Endorsements) are tall enough for their body text. */
function growTableHeightsFromContent(template: Template): Template {
  let changed = false;
  const schemas = template.schemas.map((page) =>
    page.map((schema) => {
      if (schema.type !== "table") return schema;
      const needed = estimateTableHeightMm(
        schema as Parameters<typeof estimateTableHeightMm>[0],
      );
      const current = Number(schema.height ?? 0);
      if (needed > current + 0.5) {
        changed = true;
        return { ...schema, height: needed };
      }
      return schema;
    }),
  );
  return changed ? { ...template, schemas } : template;
}

function prepareDesignerTemplate(template: Template): Template {
  return growTableHeightsFromContent(
    withPreviewContent(withBlankPageBackground(template)),
  );
}

function toBulkRefs(schemas: DesignerSelectedSchema[]): BulkSchemaRef[] {
  return schemas.map((schema) => ({
    name: schema.name,
    pageIndex: schema.pageIndex,
    schemaIndex: schema.schemaIndex,
  }));
}

function uniqueSchemaName(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}__${n}`)) n += 1;
  return `${base}__${n}`;
}

function nextFieldY(page: SchemaLike[]): number {
  let y = 15;
  for (const schema of page) {
    const bottom = Number(schema.position?.y ?? 0) + Number(schema.height ?? 0);
    if (bottom + 2 > y) y = bottom + 2;
  }
  return y > 275 ? 15 : Number(y.toFixed(2));
}

function createTextMergeSchema(name: string, y: number): SchemaLike {
  const canonical = name.replace(/__\d+$/, "");
  const isEndorsementSubject = canonical === ENDORSEMENT_SUBJECT_FIELD;
  const isEndorsementContent = canonical === ENDORSEMENT_CONTENT_FIELD;
  const isEndorsement = isEndorsementSubject || isEndorsementContent;

  return {
    name,
    type: "text",
    position: { x: 12, y },
    width: isEndorsement ? 185 : 80,
    height: isEndorsementContent ? 14 : isEndorsementSubject ? 6 : 5,
    content: isEndorsementSubject
      ? "Sample endorsement"
      : isEndorsementContent
        ? "It is hereby noted and agreed that this policy is endorsed as follows. Long wording wraps using this field’s format."
        : `{${canonical}}`,
    fontSize: isEndorsementSubject ? 11 : 9.5,
    fontColor: "#111111",
    fontName: resolvePdfmeFontName(
      "Roboto",
      isEndorsementSubject ? "700" : "400",
      "normal",
    ),
    lineHeight: isEndorsementContent ? 1.25 : 1.15,
    backgroundColor: "",
    verticalAlignment: isEndorsement ? "top" : "middle",
    overflow: "visible",
    readOnly: false,
    ...(isEndorsementSubject
      ? { [ENDORSEMENT_BLOCK_GAP_KEY]: DEFAULT_ENDORSEMENT_BLOCK_GAP_MM }
      : {}),
  };
}

type TableColumnDraft = { head: string; widthPct: string };

function readTableColumns(schema: unknown): TableColumnDraft[] {
  const s = schema as {
    head?: unknown;
    headWidthPercentages?: unknown;
  };
  const heads = Array.isArray(s.head) ? s.head.map((h) => String(h ?? "")) : [];
  const widths = Array.isArray(s.headWidthPercentages)
    ? s.headWidthPercentages.map((w) => Number(w))
    : [];
  if (heads.length === 0) return [{ head: "Column 1", widthPct: "100" }];
  return heads.map((head, i) => ({
    head,
    widthPct: String(
      Number.isFinite(widths[i]) ? Number(widths[i]!.toFixed(1)) : 0,
    ),
  }));
}

function normalizeWidthPercentages(raw: number[]): number[] {
  const cleaned = raw.map((n) => (Number.isFinite(n) && n > 0 ? n : 1));
  const sum = cleaned.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const even = 100 / Math.max(cleaned.length, 1);
    return cleaned.map(() => Number(even.toFixed(2)));
  }
  return cleaned.map((n) => Number(((n / sum) * 100).toFixed(2)));
}

function parseTableBodyRows(content: unknown): string[][] {
  if (typeof content !== "string") return [[""]];
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [[""]];
    return parsed.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [""],
    );
  } catch {
    return [[""]];
  }
}

function createEndorsementsTableSchema(name: string, y: number): SchemaLike {
  const content = endorsementsTableContent([
    {
      subject: "Sample endorsement",
      content:
        "It is hereby noted and agreed that this policy is endorsed as follows. Long wording wraps and the row height grows with the content.",
    },
  ]);
  const schema = {
    name,
    type: "table",
    position: { x: 12, y },
    width: 185,
    height: 28,
    content,
    showHead: true,
    repeatHead: true,
    head: ["Subject", "Content"],
    headWidthPercentages: [30, 70],
    tableStyles: { borderWidth: 0.1, borderColor: "#d1d5db" },
    headStyles: {
      fontSize: 9.5,
      fontColor: "#111827",
      backgroundColor: "#f3f4f6",
      borderColor: "#d1d5db",
      borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
      padding: { top: 2, right: 2, bottom: 2, left: 2 },
      alignment: "left",
      verticalAlignment: "middle",
      lineHeight: 1.2,
      characterSpacing: 0,
      fontName: "Roboto",
    },
    bodyStyles: {
      fontSize: 9,
      fontColor: "#111827",
      backgroundColor: "#ffffff",
      alternateBackgroundColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
      padding: { top: 2, right: 2, bottom: 2, left: 2 },
      alignment: "left",
      verticalAlignment: "top",
      lineHeight: 1.25,
      characterSpacing: 0,
      fontName: "Roboto",
    },
    columnStyles: {
      0: { alignment: "left" },
      1: { alignment: "left" },
    },
    required: false,
    readOnly: false,
  };
  return {
    ...schema,
    height: estimateTableHeightMm(schema, content),
  };
}

/**
 * Client-only pdfme Designer. Dynamic-imports `@pdfme/ui` so SSR never loads it.
 */
export function PdfmeDesigner({
  ref,
  template,
  editable = true,
  className,
  onTemplateChange,
  toolbarHost = null,
}: PdfmeDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<DesignerInstance | null>(null);
  const onTemplateChangeRef = useRef(onTemplateChange);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<DesignerSelectedSchema[]>([]);
  const [heightMm, setHeightMm] = useState("8");
  const [yGapMm, setYGapMm] = useState("10");
  const [endorsementBlockGapMm, setEndorsementBlockGapMmState] = useState(
    String(DEFAULT_ENDORSEMENT_BLOCK_GAP_MM),
  );
  const [fieldQuery, setFieldQuery] = useState("");
  const [mergePanelOpen, setMergePanelOpen] = useState(false);
  const [tableColumns, setTableColumns] = useState<TableColumnDraft[]>([]);
  const [usedFieldNames, setUsedFieldNames] = useState<Set<string>>(
    () => new Set(),
  );

  const filteredFields = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase();
    if (!q) return PALETTE_MERGE_FIELD_NAMES;
    return PALETTE_MERGE_FIELD_NAMES.filter((name) =>
      name.toLowerCase().includes(q),
    );
  }, [fieldQuery]);

  useEffect(() => {
    onTemplateChangeRef.current = onTemplateChange;
  }, [onTemplateChange]);

  function refreshUsedFields(nextTemplate: Template) {
    const used = new Set<string>();
    for (const page of nextTemplate.schemas) {
      for (const schema of page) {
        const name = schema.name;
        if (!name || name.startsWith("_")) continue;
        used.add(name.replace(/__\d+$/, ""));
      }
    }
    setUsedFieldNames(used);
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

    // Endorsement pair: only one Subject + Content prototype per template.
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
    setOrientation: (orientation) => {
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);

    void (async () => {
      try {
        const [{ Designer }, font] = await Promise.all([
          import("@pdfme/ui"),
          getPdfmeFonts(),
        ]);
        if (cancelled || !containerRef.current) return;

        const initial = prepareDesignerTemplate(template);
        const designer = new Designer({
          domContainer: containerRef.current,
          template: initial,
          plugins: pdfmePlugins,
          options: {
            font,
            zoomLevel: 1,
            // Keep pdfme's type palette closed — merge fields live in our list.
            sidebarOpen: false,
          },
        });
        designer.onChangeTemplate((next) => {
          const grown = growTableHeightsFromContent(next);
          const applied = grown !== next ? grown : next;
          if (grown !== next) {
            // Keep Endorsements (and other tables) tall enough for cell text.
            designer.updateTemplate(grown);
          }
          onTemplateChangeRef.current?.(applied);
          refreshUsedFields(applied);
          // Keep column editor in sync with canvas drag-resize / header edits.
          const sel = designer.getSelection?.();
          const only = sel?.schemas;
          if (only?.length === 1 && only[0]?.type === "table") {
            const page = applied.schemas[only[0].pageIndex];
            const live =
              page?.find((schema) => schema.name === only[0]!.name) ??
              only[0].schema;
            setTableColumns(readTableColumns(live));
          }
        });
        designer.onChangeSelection((selection) => {
          setSelected(selection.schemas);
          const first = selection.schemas[0];
          const schema = first?.schema as { height?: number } | undefined;
          if (
            typeof schema?.height === "number" &&
            Number.isFinite(schema.height)
          ) {
            setHeightMm(String(schema.height));
          }
          if (
            selection.schemas.length === 1 &&
            selection.schemas[0]?.type === "table"
          ) {
            setTableColumns(readTableColumns(selection.schemas[0].schema));
          } else {
            setTableColumns([]);
          }
          const endorsementSelected = selection.schemas.some((item) => {
            const base = String(item.name ?? "").replace(/__\d+$/, "");
            return (
              base === ENDORSEMENT_SUBJECT_FIELD ||
              base === ENDORSEMENT_CONTENT_FIELD
            );
          });
          if (endorsementSelected && designerRef.current) {
            setEndorsementBlockGapMmState(
              String(
                readEndorsementBlockGapMm(designerRef.current.getTemplate()),
              ),
            );
          }
        });
        designerRef.current = designer;
        containerRef.current.style.pointerEvents = editable ? "auto" : "none";
        refreshUsedFields(initial);
        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load the PDF template designer.",
        );
      }
    })();

    return () => {
      cancelled = true;
      designerRef.current?.destroy();
      designerRef.current = null;
    };
    // Parent remounts with `key` when the template identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per key
  }, []);

  function applyBulk(
    nextTemplate: Template,
    options?: { restoreSelection?: boolean },
  ) {
    const designer = designerRef.current;
    if (!designer) return;
    const restoreSelection = options?.restoreSelection ?? true;
    // Prefer name — updateTemplate regenerates schema ids asynchronously.
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
    // pdfme's template2SchemasList is async and clears selection when done.
    window.setTimeout(() => {
      designer.selectSchemas(targets);
    }, 80);
  }

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
    // Leave deselected: pdfme puts active schemas at z-index 1, which hides
    // layer changes while they remain selected.
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
        const source = schema as unknown as SchemaLike;
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
      // Keep columnStyles keys aligned when column count changes.
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
    <div className="flex max-w-full flex-wrap items-center gap-1.5">
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        {selectionCount} selected
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!textSelected}
        onClick={() => handleBold(true)}
        title="Make selected text bold"
      >
        <BoldIcon data-icon="inline-start" />
        Bold
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!textSelected}
        onClick={() => handleBold(false)}
        title="Make selected text regular"
      >
        Regular
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTransparentBackground}
        title="Clear fill / background on selected elements"
      >
        <DropletOffIcon data-icon="inline-start" />
        Transparent
      </Button>
      <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleZOrder("back")}
        title="Send selected elements behind all others"
      >
        <SendToBackIcon data-icon="inline-start" />
        Back
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleZOrder("front")}
        title="Bring selected elements in front of all others"
      >
        <BringToFrontIcon data-icon="inline-start" />
        Front
      </Button>
      <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor="bulk-height">
          Height (mm)
        </label>
        <Input
          id="bulk-height"
          type="number"
          min={0.5}
          step={0.5}
          value={heightMm}
          onChange={(event) => setHeightMm(event.target.value)}
          className="h-7 w-16 text-xs"
          aria-label="Height in mm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSetHeight}
          title="Set height on all selected"
        >
          Set height
        </Button>
      </div>
      <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor="bulk-y-gap">
          Y gap (mm)
        </label>
        <Input
          id="bulk-y-gap"
          type="number"
          min={0}
          step={0.5}
          value={yGapMm}
          onChange={(event) => setYGapMm(event.target.value)}
          className="h-7 w-16 text-xs"
          aria-label="Y gap in mm"
          disabled={selectionCount < 2}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selectionCount < 2}
          onClick={handleSpaceVertically}
          title="Set Y positions from the first selected field: Y, Y+gap, Y+2×gap…"
        >
          <UnfoldVerticalIcon data-icon="inline-start" />
          Set Y gap
        </Button>
      </div>
      {endorsementPairSelected ? (
        <>
          <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
          <div className="flex items-center gap-1">
            <label className="sr-only" htmlFor="endorsement-block-gap">
              Endorsement block gap (mm)
            </label>
            <Input
              id="endorsement-block-gap"
              type="number"
              min={0}
              step={0.5}
              value={endorsementBlockGapMm}
              onChange={(event) =>
                setEndorsementBlockGapMmState(event.target.value)
              }
              className="h-7 w-16 text-xs"
              aria-label="Endorsement block gap in mm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSetEndorsementBlockGap}
              title="Space between each endorsement block when the list is generated"
            >
              Block gap
            </Button>
          </div>
        </>
      ) : null}
      {tableSelected ? (
        <>
          <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1 text-xs text-muted-foreground">
              <Columns3Icon className="size-3.5" />
              Columns
            </span>
            {tableColumns.map((col, index) => (
              <div
                key={`table-col-${index}`}
                className="flex items-center gap-1 rounded-md border bg-background px-1 py-0.5"
              >
                <Input
                  value={col.head}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTableColumns((cols) =>
                      cols.map((c, i) =>
                        i === index ? { ...c, head: value } : c,
                      ),
                    );
                  }}
                  className="h-7 w-24 text-xs"
                  aria-label={`Column ${index + 1} name`}
                  placeholder={`Column ${index + 1}`}
                />
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={col.widthPct}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTableColumns((cols) =>
                      cols.map((c, i) =>
                        i === index ? { ...c, widthPct: value } : c,
                      ),
                    );
                  }}
                  className="h-7 w-14 text-xs"
                  aria-label={`Column ${index + 1} width percent`}
                  title="Width %"
                />
                <span className="pr-0.5 text-[10px] text-muted-foreground">
                  %
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={tableColumns.length <= 1}
                  onClick={() => handleRemoveTableColumn(index)}
                  title={`Remove column ${index + 1}`}
                >
                  <MinusIcon className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTableColumn}
              title="Add column"
            >
              <PlusIcon data-icon="inline-start" />
              Col
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleApplyTableColumns}
              title="Apply column names and widths (normalized to 100%)"
            >
              Apply columns
            </Button>
          </div>
        </>
      ) : null}
    </div>
  ) : null;

  return (
    <div className={cn("relative flex h-full min-h-0", className)}>
      {status === "loading" ? (
        <div className="absolute inset-0 z-10 bg-background">
          <DocumentTemplatesEditorSkeleton className="h-full min-h-0 rounded-none border-0" />
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
        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-2">
          <div className="pointer-events-auto rounded-lg border bg-background/95 p-1.5 shadow-sm backdrop-blur-sm">
            {toolbar}
          </div>
        </div>
      ) : null}

      {editable ? (
        <div className="flex shrink-0">
          <div className="flex w-10 flex-col items-center gap-1 border-r bg-muted/30 py-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant={mergePanelOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="size-8"
                    aria-pressed={mergePanelOpen}
                    aria-expanded={mergePanelOpen}
                    aria-controls="merge-fields-panel"
                    aria-label="Merge fields"
                    onClick={() => setMergePanelOpen((open) => !open)}
                  />
                }
              >
                <BracesIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right">
                {mergePanelOpen ? "Hide merge fields" : "Show merge fields"}
              </TooltipContent>
            </Tooltip>
          </div>
          <aside
            id="merge-fields-panel"
            className={cn(
              "flex flex-col overflow-hidden border-r bg-muted/20 transition-[width] duration-200 ease-out",
              mergePanelOpen ? "w-56" : "w-0 border-r-0",
            )}
            aria-hidden={!mergePanelOpen}
          >
            <div className="flex h-full w-56 flex-col">
              <div className="border-b p-2">
                <p className="mb-1.5 px-0.5 text-xs font-medium text-foreground">
                  Merge fields
                </p>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={fieldQuery}
                    onChange={(event) => setFieldQuery(event.target.value)}
                    placeholder="Search fields…"
                    className="h-8 pl-7 text-xs"
                    aria-label="Search merge fields"
                    tabIndex={mergePanelOpen ? 0 : -1}
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {filteredFields.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No matching fields.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {filteredFields.map((name) => {
                      const used = usedFieldNames.has(name);
                      const isTable = name === ENDORSEMENTS_TABLE_FIELD;
                      return (
                        <li key={name}>
                          <button
                            type="button"
                            disabled={status !== "ready" || !mergePanelOpen}
                            onClick={() => addMergeField(name)}
                            title={
                              used
                                ? `Add another ${name} to the current page`
                                : `Add ${name} to the current page`
                            }
                            className={cn(
                              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                              "hover:bg-accent hover:text-accent-foreground",
                              "disabled:pointer-events-none disabled:opacity-50",
                              used && "text-muted-foreground",
                            )}
                          >
                            <span className="truncate font-mono">{name}</span>
                            {isTable || used ? (
                              <span className="ml-2 shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
                                {isTable ? "table" : "on page"}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <div ref={containerRef} className="min-w-0 flex-1" />
    </div>
  );
}
