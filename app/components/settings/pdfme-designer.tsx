import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Template } from "@pdfme/common";
import type { DesignerSelectedSchema, DesignerSelection } from "@pdfme/ui";
import {
  BoldIcon,
  BringToFrontIcon,
  DropletOffIcon,
  SendToBackIcon,
  UnfoldVerticalIcon,
} from "lucide-react";
import { DocumentTemplatesEditorSkeleton } from "~/components/settings/document-templates-loading";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  applyFontWeightToSchemas,
  applyHeightToSchemas,
  applyTransparentBackground,
  moveSchemasZOrder,
  spaceSchemasVertically,
  type BulkSchemaRef,
} from "~/lib/pdf/bulk-format";
import { getPdfmeFonts } from "~/lib/pdf/fonts";
import { pdfmePlugins } from "~/lib/pdf/plugins";
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
};

type PdfmeDesignerProps = {
  ref?: React.Ref<PdfmeDesignerHandle>;
  template: Template;
  editable?: boolean;
  className?: string;
  /** Fires when the designer template changes (move/edit/add/remove). */
  onTemplateChange?: (template: Template) => void;
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

function prepareDesignerTemplate(template: Template): Template {
  return withPreviewContent(withBlankPageBackground(template));
}

function toBulkRefs(schemas: DesignerSelectedSchema[]): BulkSchemaRef[] {
  return schemas.map((schema) => ({
    name: schema.name,
    pageIndex: schema.pageIndex,
    schemaIndex: schema.schemaIndex,
  }));
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

  useEffect(() => {
    onTemplateChangeRef.current = onTemplateChange;
  }, [onTemplateChange]);

  useImperativeHandle(ref, () => ({
    getTemplate: () => designerRef.current?.getTemplate() ?? null,
    updateTemplate: (next) => {
      const designer = designerRef.current;
      if (!designer) return;
      const prepared = prepareDesignerTemplate(next);
      designer.updateTemplate(prepared);
      onTemplateChangeRef.current?.(prepared);
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

        const designer = new Designer({
          domContainer: containerRef.current,
          template: prepareDesignerTemplate(template),
          plugins: pdfmePlugins,
          options: {
            font,
            zoomLevel: 1,
            sidebarOpen: true,
          },
        });
        designer.onChangeTemplate((next) => {
          onTemplateChangeRef.current?.(next);
        });
        designer.onChangeSelection((selection) => {
          setSelected(selection.schemas);
          const first = selection.schemas[0]?.schema as
            { height?: number } | undefined;
          if (
            typeof first?.height === "number" &&
            Number.isFinite(first.height)
          ) {
            setHeightMm(String(first.height));
          }
        });
        designerRef.current = designer;
        containerRef.current.style.pointerEvents = editable ? "auto" : "none";
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

  const selectionCount = selected.length;
  const showToolbar = editable && status === "ready" && selectionCount > 0;
  const textSelected = selected.some(
    (item) => item.type === "text" || item.type === "multiVariableText",
  );

  return (
    <div className={cn("relative h-full min-h-0", className)}>
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

      {showToolbar ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-2">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border bg-background/95 p-1.5 shadow-sm backdrop-blur-sm">
            <span className="px-1.5 text-xs text-muted-foreground tabular-nums">
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
          </div>
        </div>
      ) : null}

      <div ref={containerRef} className="size-full" />
    </div>
  );
}
