/**
 * HTML and text utility functions for rich text rendering.
 * Extracted from html-rich-text-lines.ts to reduce file size.
 */

import type { RichTextRunStyle } from "./html-rich-text-lines";

/**
 * Decode common HTML entities in text.
 * Handles the entities needed for PDF rendering: &nbsp;, &amp;, &lt;, &gt;, &quot;, &#39;
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Read an attribute value from HTML attributes string.
 * Handles quoted and unquoted attribute values.
 * Returns null if attribute not found.
 */
export function readAttr(attrs: string, name: string): string | null {
  const re = new RegExp(
    `${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const m = re.exec(attrs);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

/**
 * Parse CSS style declarations into a key-value object.
 * Converts property names to lowercase for consistent access.
 */
export function parseStyleDecls(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const [prop, ...rest] = decl.split(":");
    if (!prop || rest.length === 0) continue;
    out[prop.trim().toLowerCase()] = rest.join(":").trim();
  }
  return out;
}

/**
 * Create a shallow copy of a RichTextRunStyle object.
 */
export function cloneStyle(style: RichTextRunStyle): RichTextRunStyle {
  return { ...style };
}

/**
 * Check if a string looks like HTML (contains HTML tags).
 * Simple heuristic: looks for opening and closing angle brackets.
 */
export function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text) && /<\/[a-z]+>/i.test(text);
}

/**
 * Normalize whitespace in text for consistent rendering.
 * Replaces multiple spaces with single space, trims edges.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Extract text content from HTML string (simple implementation).
 * Removes tags and returns only text content.
 */
export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate text width using character count heuristic.
 * Used when exact font metrics are not available.
 */
export function estimateTextWidth(text: string, fontSizePt: number): number {
  // Average character width in typical proportionally spaced fonts
  const avgCharWidth = 0.6;
  const charCount = text.replace(/\s/g, "").length;
  return charCount * fontSizePt * avgCharWidth;
}

/**
 * Check if a style change is significant (affects rendering).
 * Compares bold, italic, underline, fontSizePt, and family.
 */
export function isStyleChangeSignificant(
  current: RichTextRunStyle,
  next: RichTextRunStyle,
): boolean {
  return (
    current.bold !== next.bold ||
    current.italic !== next.italic ||
    current.underline !== next.underline ||
    current.fontSizePt !== next.fontSizePt ||
    current.family !== next.family
  );
}

/**
 * Merge two text runs if they have identical styles.
 * Used during line construction to minimize run count.
 */
export function mergeTextRuns(
  run1: { text: string; style: RichTextRunStyle },
  run2: { text: string; style: RichTextRunStyle },
): { text: string; style: RichTextRunStyle } | null {
  if (
    run1.style.bold === run2.style.bold &&
    run1.style.italic === run2.style.italic &&
    run1.style.underline === run2.style.underline &&
    run1.style.fontSizePt === run2.style.fontSizePt &&
    run1.style.family === run2.style.family
  ) {
    return {
      text: run1.text + run2.text,
      style: run1.style,
    };
  }
  return null;
}
