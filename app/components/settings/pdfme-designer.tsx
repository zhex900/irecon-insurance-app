import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Template } from "@pdfme/common";
import { pdfmePlugins } from "~/lib/pdf/plugins";

export type PdfmeDesignerHandle = {
  getTemplate: () => Template | null;
  updateTemplate: (template: Template) => void;
};

type PdfmeDesignerProps = {
  ref?: React.Ref<PdfmeDesignerHandle>;
  template: Template;
  editable?: boolean;
  className?: string;
};

type DesignerInstance = {
  getTemplate: () => Template;
  updateTemplate: (template: Template) => void;
  destroy: () => void;
};

/** Make merge fields show editable sample text; keep fills transparent. */
function withEditablePreviewContent(template: Template): Template {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((schema) => {
        const next = {
          ...schema,
          // Never paint an opaque field fill over Word chrome.
          backgroundColor: "",
        };
        if (schema.type !== "text" && schema.type !== "multiVariableText") {
          return next;
        }
        const content =
          typeof schema.content === "string" ? schema.content.trim() : "";
        if (content) return next;
        return {
          ...next,
          content: schema.name || "Text",
        };
      }),
    ),
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
}: PdfmeDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<DesignerInstance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    getTemplate: () => designerRef.current?.getTemplate() ?? null,
    updateTemplate: (next) => {
      designerRef.current?.updateTemplate(withEditablePreviewContent(next));
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
        const { Designer } = await import("@pdfme/ui");
        if (cancelled || !containerRef.current) return;

        const designer = new Designer({
          domContainer: containerRef.current,
          template: withEditablePreviewContent(template),
          plugins: pdfmePlugins,
          options: {
            zoomLevel: 1,
            sidebarOpen: true,
          },
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
    // Parent remounts with `key` when the slot/version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per key
  }, []);

  return (
    <div className={className} style={{ position: "relative", minHeight: 480 }}>
      {status === "loading" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
          Loading designer…
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background p-6 text-center text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: 480 }}
      />
    </div>
  );
}
