import { useCallback, useEffect, useRef, useState } from "react";
import type { Template } from "@pdfme/common";
import type { DesignerSelectedSchema } from "@pdfme/ui";
import {
  type DesignerInstance,
  growTableHeightsFromContent,
  prepareDesignerTemplate,
  readTableColumns,
  type TableColumnDraft,
} from "~/components/documents/pdfme-designer-helpers";
import {
  DEFAULT_ENDORSEMENT_BLOCK_GAP_MM,
  ENDORSEMENT_CONTENT_FIELD,
  ENDORSEMENT_SUBJECT_FIELD,
  readEndorsementBlockGapMm,
} from "~/lib/pdf/endorsement-expand";
import { getPdfmeFonts } from "~/lib/pdf/fonts";
import { pdfmePlugins } from "~/lib/pdf/plugins";

export function usePdfmeDesignerLifecycle({
  template,
  editable,
  onTemplateChange,
}: {
  template: Template;
  editable: boolean;
  onTemplateChange?: (template: Template) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<DesignerInstance | null>(null);
  const onTemplateChangeRef = useRef(onTemplateChange);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<DesignerSelectedSchema[]>([]);
  const [heightMm, setHeightMm] = useState("8");
  const [endorsementBlockGapMm, setEndorsementBlockGapMmState] = useState(
    String(DEFAULT_ENDORSEMENT_BLOCK_GAP_MM),
  );
  const [tableColumns, setTableColumns] = useState<TableColumnDraft[]>([]);
  const [usedFieldNames, setUsedFieldNames] = useState<Set<string>>(
    () => new Set(),
  );

  const refreshUsedFields = useCallback((nextTemplate: Template) => {
    const used = new Set<string>();
    for (const page of nextTemplate.schemas) {
      for (const schema of page) {
        const name = schema.name;
        if (!name || name.startsWith("_")) continue;
        used.add(name.replace(/__\d+$/, ""));
      }
    }
    setUsedFieldNames(used);
  }, []);

  useEffect(() => {
    onTemplateChangeRef.current = onTemplateChange;
  }, [onTemplateChange]);

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
            sidebarOpen: false,
          },
        });
        designer.onChangeTemplate((next) => {
          const grown = growTableHeightsFromContent(next);
          const applied = grown !== next ? grown : next;
          if (grown !== next) {
            designer.updateTemplate(grown);
          }
          onTemplateChangeRef.current?.(applied);
          refreshUsedFields(applied);
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

  return {
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
  };
}
