/**
 * HTML parsing utilities for rich text rendering.
 * Extracted from html-rich-text-lines.ts to reduce file size.
 */

import type { PdfmeFontFamily } from "~/lib/pdf/font-config";
import {
  defaultListStyleForTag,
  formatWordingListMarker,
  isWordingListStyle,
} from "~/lib/policies/wording/html";
import type { WordingListStyle } from "~/lib/policies/wording/html";

export type RichTextRunStyle = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSizePt: number;
  family: PdfmeFontFamily;
};

export type TextRun = {
  text: string;
  style: RichTextRunStyle;
};

export type DrawLine = {
  runs: TextRun[];
  indentPx: number;
  marker?: string;
  /** Same <ol>/<ul> instance — used to size/align the shared marker column. */
  listGroupId?: number;
};

export type HtmlToDrawLinesOptions = {
  /**
   * Keep font family + size locked to the schema (EndorsementSubject /
   * EndorsementContent). Still honours bold / italic / underline from HTML.
   */
  lockSchemaMetrics?: boolean;
};

// Helper functions for HTML parsing
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function readAttr(attrs: string, name: string): string | null {
  const re = new RegExp(
    `${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const m = re.exec(attrs);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

export function parseStyleDecls(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const [prop, ...rest] = decl.split(":");
    if (!prop || rest.length === 0) continue;
    out[prop.trim().toLowerCase()] = rest.join(":").trim();
  }
  return out;
}

export function cloneStyle(style: RichTextRunStyle): RichTextRunStyle {
  return { ...style };
}

// Token types for HTML parsing
export type HtmlTokenType = "tag-open" | "tag-close" | "text" | "comment";

export interface HtmlToken {
  type: HtmlTokenType;
  tag?: string;
  attrs?: string;
  content?: string;
}

/**
 * Simple HTML tokenizer that handles the subset needed for PDF rendering.
 * This is not a full HTML parser - it only handles tags and text.
 */
export function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  let pos = 0;

  while (pos < html.length) {
    // Skip whitespace between tokens
    if (html[pos] === " ") {
      pos++;
      continue;
    }

    // Handle comments
    if (html.substr(pos, 4) === "<!--") {
      const endPos = html.indexOf("-->", pos);
      if (endPos === -1) break;
      tokens.push({
        type: "comment",
        content: html.substring(pos + 4, endPos),
      });
      pos = endPos + 3;
      continue;
    }

    // Handle opening tags
    if (html[pos] === "<" && html[pos + 1] !== "/") {
      const endPos = html.indexOf(">", pos);
      if (endPos === -1) break;

      const tagContent = html.substring(pos + 1, endPos).trim();
      const spaceIndex = tagContent.indexOf(" ");

      let tag: string;
      let attrs = "";

      if (spaceIndex !== -1) {
        tag = tagContent.substring(0, spaceIndex).toLowerCase();
        attrs = tagContent.substring(spaceIndex + 1);
      } else {
        tag = tagContent.toLowerCase();
      }

      tokens.push({
        type: "tag-open",
        tag,
        attrs,
      });
      pos = endPos + 1;
      continue;
    }

    // Handle closing tags
    if (html[pos] === "<" && html[pos + 1] === "/") {
      const endPos = html.indexOf(">", pos);
      if (endPos === -1) break;

      const tag = html
        .substring(pos + 2, endPos)
        .trim()
        .toLowerCase();
      tokens.push({
        type: "tag-close",
        tag,
      });
      pos = endPos + 1;
      continue;
    }

    // Handle text content
    const nextTagPos = html.indexOf("<", pos);
    if (nextTagPos === -1) {
      // No more tags, rest is text
      const text = html.substring(pos);
      if (text.trim()) {
        tokens.push({
          type: "text",
          content: text,
        });
      }
      break;
    }

    if (nextTagPos > pos) {
      const text = html.substring(pos, nextTagPos);
      if (text.trim()) {
        tokens.push({
          type: "text",
          content: text,
        });
      }
      pos = nextTagPos;
    }
  }

  return tokens;
}

/**
 * Extract list style from HTML attributes.
 * Used for <ol> and <ul> tags with data-list-style attribute.
 */
export function extractListStyle(attrs: string): WordingListStyle | null {
  const listStyle = readAttr(attrs, "data-list-style");
  if (listStyle && isWordingListStyle(listStyle)) {
    return listStyle;
  }
  return null;
}

/**
 * Get default list marker for a tag type.
 */
export function getDefaultListMarker(
  tag: string,
  listStyle: WordingListStyle | null,
): string {
  if (tag === "ol" && listStyle) {
    return formatWordingListMarker(listStyle, 1);
  }
  if (tag === "ul" || tag === "ol") {
    return defaultListStyleForTag(tag);
  }
  return "- ";
}

/**
 * Calculate indentation level based on nested list structure.
 */
export function calculateIndentPx(stackDepth: number): number {
  // Standard CSS-like indentation: 40px per level
  return stackDepth * 40;
}
