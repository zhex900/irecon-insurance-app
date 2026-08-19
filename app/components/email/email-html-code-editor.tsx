import { AlignLeftIcon } from "lucide-react";
import { type UIEvent, useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { formatEmailHtml } from "~/lib/email/format-html";
import { cn } from "~/lib/utils";

type EmailHtmlCodeEditorProps = {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
};

const CODE_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export function EmailHtmlCodeEditor({
  value,
  onChange,
  readOnly = false,
  className,
  "aria-label": ariaLabel = "Email HTML source",
}: EmailHtmlCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const [formatting, setFormatting] = useState(false);
  const [prismModule, setPrismModule] = useState<
    typeof import("prismjs") | null
  >(null);

  // Load prismjs dynamically on the client side
  useEffect(() => {
    if (prismModule) return;

    Promise.all([
      import("prismjs"),
      import("prismjs/themes/prism-tomorrow.css"),
    ])
      .then(([prism]) => {
        setPrismModule(prism.default || prism);
      })
      .catch((error) => {
        console.error("Failed to load prismjs:", error);
      });
  }, [prismModule]);

  function highlightMarkup(code: string): string {
    // Always use basic escaping for server-side rendering
    // Only use Prism when it's loaded on the client
    if (!prismModule || typeof window === "undefined") {
      return code
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    // Use the loaded Prism module
    const Prism = prismModule;
    if (!Prism.languages || !Prism.languages.markup) {
      return code
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }
    return Prism.highlight(code, Prism.languages.markup, "markup");
  }

  // Trailing newline keeps highlight height in sync with <textarea>.
  const highlighted = `${highlightMarkup(value)}\n`;

  function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
    const pre = highlightRef.current;
    if (!pre) return;
    pre.scrollTop = event.currentTarget.scrollTop;
    pre.scrollLeft = event.currentTarget.scrollLeft;
  }

  async function handleFormat() {
    if (readOnly || formatting) return;
    setFormatting(true);
    try {
      const next = await formatEmailHtml(value);
      if (next !== value) onChange(next);
    } finally {
      setFormatting(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div
      className={cn("email-html-code-editor flex flex-col gap-2", className)}
    >
      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || formatting}
          onClick={() => void handleFormat()}
        >
          <AlignLeftIcon data-icon="inline-start" />
          {formatting ? "Formatting…" : "Format"}
        </Button>
      </div>
      <div
        className={cn(
          "relative h-[min(36rem,65vh)] min-h-[min(36rem,65vh)] overflow-hidden rounded-lg border border-input",
          "bg-[#2d2d2d] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        )}
      >
        <pre
          ref={highlightRef}
          aria-hidden
          className="email-html-code-editor__layer email-html-code-editor__highlight"
        >
          <code
            className="language-markup"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={ariaLabel}
          onScroll={syncScroll}
          onChange={(event) => {
            if (readOnly) return;
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (
              (event.metaKey || event.ctrlKey) &&
              event.shiftKey &&
              event.key.toLowerCase() === "f"
            ) {
              event.preventDefault();
              void handleFormat();
            }
          }}
          className={cn(
            "email-html-code-editor__layer email-html-code-editor__textarea",
            readOnly && "cursor-default opacity-80",
          )}
        />
      </div>
      <style>{`
        .email-html-code-editor__layer {
          position: absolute;
          inset: 0;
          box-sizing: border-box;
          margin: 0;
          padding: 10px;
          border: 0;
          overflow: auto;
          width: 100%;
          height: 100%;
          font-family: ${CODE_FONT};
          font-size: 12px;
          font-weight: 400;
          font-variant-ligatures: none;
          font-feature-settings: normal;
          line-height: 20px;
          letter-spacing: normal;
          word-spacing: normal;
          tab-size: 2;
          -moz-tab-size: 2;
          white-space: pre;
          word-break: normal;
          word-wrap: normal;
          overflow-wrap: normal;
          hyphens: none;
          text-align: left;
          text-indent: 0;
          background: transparent;
        }
        .email-html-code-editor__highlight {
          pointer-events: none;
          z-index: 0;
          color: #ccc;
        }
        .email-html-code-editor__highlight code,
        .email-html-code-editor__highlight code[class*="language-"] {
          display: block;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: none !important;
          font: inherit !important;
          line-height: inherit !important;
          letter-spacing: inherit !important;
          word-spacing: inherit !important;
          tab-size: inherit !important;
          -moz-tab-size: inherit !important;
          white-space: inherit !important;
          word-break: inherit !important;
          word-wrap: inherit !important;
          overflow-wrap: inherit !important;
          text-shadow: none !important;
          color: inherit;
        }
        .email-html-code-editor__textarea {
          z-index: 1;
          resize: none;
          outline: none;
          color: transparent;
          caret-color: #fff;
          -webkit-text-fill-color: transparent;
        }
        .email-html-code-editor__textarea::selection {
          background: rgb(14 165 233 / 0.4);
          color: transparent;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
    </div>
  );
}
