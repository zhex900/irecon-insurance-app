import { useEffect, useRef } from "react";
import {
  EMAIL_DOCUMENT_ELEMENT_CSS,
  EMAIL_DOCUMENT_SURFACE_CSS,
  materializeEmailTableAttrs,
} from "~/lib/email/templates";
import { cn } from "~/lib/utils";

type EmailDocumentFrameProps = {
  html: string;
  title?: string;
  className?: string;
  /** When true, body is contentEditable and edits call onHtmlChange. */
  editable?: boolean;
  onHtmlChange?: (html: string) => void;
  /** Bump to force reload from `html` (Reset, undo, Code→Visual). */
  reloadKey?: string | number;
};

/**
 * Sandboxed iframe for ASCX email HTML.
 * Visual (editable) and Preview (read-only) must pass the same `html`.
 */
function buildEmailDocumentSrcDoc(bodyHtml: string): string {
  // cellpadding → inline padding (same look as inboxes / sent mail)
  const body = materializeEmailTableAttrs(bodyHtml.trim()) || "&nbsp;";
  // Basic security sanitization - remove script tags and dangerous attributes
  const sanitizedBody = body
    .replace(/<\/?(script|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; padding: 0; }
  body {
    ${EMAIL_DOCUMENT_SURFACE_CSS}
    padding: 16px;
    word-wrap: break-word;
    outline: none;
  }
  ${EMAIL_DOCUMENT_ELEMENT_CSS}
  /* Merge-field tokens (match .email-placeholder-tag in app.css) */
  .email-placeholder-tag {
    display: inline;
    border-radius: 9999px;
    border: 1px solid #e6b800;
    background: #fff3cd;
    color: #7a5b00;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8125em;
    font-weight: 600;
    letter-spacing: 0.01em;
    padding: 0.1em 0.45em;
    white-space: nowrap;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
</style>
</head>
<body>${sanitizedBody}</body>
</html>`;
}

export function EmailDocumentFrame({
  html,
  title = "Email document",
  className,
  editable = false,
  onHtmlChange,
  reloadKey = 0,
}: EmailDocumentFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onHtmlChangeRef = useRef(onHtmlChange);
  const editingRef = useRef(false);
  const loadedHtmlRef = useRef<string | null>(null);
  const reloadKeyRef = useRef(reloadKey);

  useEffect(() => {
    onHtmlChangeRef.current = onHtmlChange;
  }, [onHtmlChange]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const forced = reloadKeyRef.current !== reloadKey;
    reloadKeyRef.current = reloadKey;

    if (forced) {
      editingRef.current = false;
    } else if (editingRef.current) {
      // Parent echoed our onHtmlChange — keep caret, don't rewrite srcdoc.
      loadedHtmlRef.current = html;
      return;
    } else if (loadedHtmlRef.current === html) {
      return;
    }

    loadedHtmlRef.current = html;
    iframe.srcdoc = buildEmailDocumentSrcDoc(html);
  }, [html, reloadKey]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      const body = iframe.contentDocument?.body;
      if (!body) return;

      body.contentEditable = editable ? "true" : "false";
      body.spellcheck = false;

      if (!editable) return;

      const emit = () => {
        onHtmlChangeRef.current?.(body.innerHTML);
      };
      const onFocus = () => {
        editingRef.current = true;
      };
      const onBlur = () => {
        editingRef.current = false;
        emit();
      };
      const onInput = () => {
        editingRef.current = true;
        emit();
      };

      body.addEventListener("focus", onFocus);
      body.addEventListener("blur", onBlur);
      body.addEventListener("input", onInput);
    };

    iframe.addEventListener("load", onLoad);
    // srcdoc may finish before the listener is attached
    if (iframe.contentDocument?.readyState === "complete") {
      onLoad();
    }
    return () => {
      iframe.removeEventListener("load", onLoad);
    };
  }, [editable, reloadKey]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      sandbox="allow-same-origin allow-scripts allow-forms"
      className={cn("block w-full border-0 bg-white", className)}
    />
  );
}
