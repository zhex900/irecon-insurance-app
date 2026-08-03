/**
 * Additional Wording stores TipTap HTML for subject + content.
 * Legacy plain text is accepted and converted on read/edit.
 */

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "li",
  "ul",
  "ol",
  "h1",
  "h2",
  "h3",
  "h4",
  "br",
]);

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "div",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "span",
]);

const FONT_FAMILIES = ["Roboto", "Times New Roman"] as const;
export type WordingFontFamily = (typeof FONT_FAMILIES)[number];

export const WORDING_FONT_FAMILIES = FONT_FAMILIES;

export const WORDING_FONT_SIZES = [
  "9",
  "10",
  "11",
  "12",
  "14",
  "16",
  "18",
] as const;

/** List markers for Additional Wording (stored as data-list-style on ul/ol). */
export const WORDING_LIST_STYLES = [
  "disc",
  "dash",
  "decimal",
  "lower-alpha",
  "lower-roman",
] as const;
export type WordingListStyle = (typeof WORDING_LIST_STYLES)[number];

export function isWordingListStyle(value: string): value is WordingListStyle {
  return (WORDING_LIST_STYLES as readonly string[]).includes(value);
}

export function defaultListStyleForTag(tag: "ul" | "ol"): WordingListStyle {
  return tag === "ul" ? "disc" : "decimal";
}

function toLowerAlpha(index: number): string {
  // 1 → a, 26 → z, 27 → aa
  let n = Math.max(1, index);
  let out = "";
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

function toLowerRoman(index: number): string {
  const n = Math.max(1, Math.min(index, 3999));
  const map: Array<[number, string]> = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let remaining = n;
  let out = "";
  for (const [value, numeral] of map) {
    while (remaining >= value) {
      out += numeral;
      remaining -= value;
    }
  }
  return out;
}

/** 1-based index → marker text including trailing space. */
export function formatWordingListMarker(
  style: WordingListStyle,
  index: number,
): string {
  switch (style) {
    case "dash":
      return "- ";
    case "decimal":
      return `${index}. `;
    case "lower-alpha":
      return `${toLowerAlpha(index)}) `;
    case "lower-roman":
      return `(${toLowerRoman(index)}) `;
    case "disc":
    default:
      // ASCII-safe — pdf-lib custom font subsetting can drop U+2022.
      return "- ";
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** True when value looks like HTML markup (not just plain text). */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Convert legacy plain text (newlines) into TipTap-friendly paragraphs. */
export function plainTextToWordingHtml(text: string): string {
  const raw = String(text ?? "");
  if (!raw.trim()) return "";
  if (looksLikeHtml(raw)) return sanitizeWordingHtml(raw);
  return raw
    .split(/\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

/** Normalize stored value for the rich editor (plain → HTML). */
export function ensureWordingHtml(value: string): string {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  if (looksLikeHtml(raw)) return sanitizeWordingHtml(raw);
  return plainTextToWordingHtml(raw);
}

/**
 * Allowlisted HTML for Additional Wording. Strips scripts/events and
 * keeps only formatting TipTap emits (incl. font-size / font-family / indent).
 */
export function sanitizeWordingHtml(html: string): string {
  const raw = String(html ?? "");
  if (!raw.trim()) return "";

  // Drop comments / scripts / styles wholesale.
  const input = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "");

  let out = "";
  const tokenRe = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(input)) !== null) {
    if (match[3] != null) {
      out += escapeHtml(decodeEntities(match[3]));
      continue;
    }
    const tag = (match[1] ?? "").toLowerCase();
    const isClose = match[0].startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (isClose) {
      out += `</${tag}>`;
      continue;
    }
    if (tag === "br") {
      out += "<br>";
      continue;
    }
    const attrs = match[2] ?? "";
    const style = sanitizeStyleAttr(attrs);
    const dataIndent = readAttr(attrs, "data-indent");
    const dataListStyle = readAttr(attrs, "data-list-style");
    const attrParts: string[] = [];
    if (style) attrParts.push(`style="${style}"`);
    if (dataIndent && /^\d+$/.test(dataIndent) && Number(dataIndent) > 0) {
      attrParts.push(`data-indent="${dataIndent}"`);
    }
    if (
      (tag === "ul" || tag === "ol") &&
      dataListStyle &&
      isWordingListStyle(dataListStyle)
    ) {
      attrParts.push(`data-list-style="${dataListStyle}"`);
    }
    out += attrParts.length ? `<${tag} ${attrParts.join(" ")}>` : `<${tag}>`;
  }
  // TipTap keeps a trailing empty <p></p> after lists that users cannot
  // delete; drop empty blocks only at the end so PDF spacing stays tight.
  return trimTrailingEmptyBlocks(out);
}

/** Remove trailing empty paragraphs / breaks (TipTap list terminator). */
export function trimTrailingEmptyBlocks(html: string): string {
  let out = String(html ?? "").trimEnd();
  const emptyTail =
    /(?:<p>(?:\s|<br\s*\/?>)*<\/p>|<div>(?:\s|<br\s*\/?>)*<\/div>|(?:<br\s*\/?>))+(\s*)$/i;
  while (emptyTail.test(out)) {
    out = out.replace(emptyTail, "").trimEnd();
  }
  return out;
}

function readAttr(attrs: string, name: string): string | null {
  const re = new RegExp(
    `${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const m = re.exec(attrs);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

function sanitizeStyleAttr(attrs: string): string {
  const style = readAttr(attrs, "style");
  if (!style) return "";
  const parts: string[] = [];
  for (const decl of style.split(";")) {
    const [rawProp, ...rest] = decl.split(":");
    if (!rawProp || rest.length === 0) continue;
    const prop = rawProp.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!value) continue;
    if (prop === "font-weight" && /^(bold|700|normal|400)$/i.test(value)) {
      parts.push(`font-weight: ${value.toLowerCase()}`);
    } else if (prop === "font-style" && /^(italic|normal)$/i.test(value)) {
      parts.push(`font-style: ${value.toLowerCase()}`);
    } else if (
      prop === "text-decoration" &&
      /underline/i.test(value) &&
      !/none/i.test(value)
    ) {
      parts.push("text-decoration: underline");
    } else if (prop === "font-size") {
      const size = parseFontSizePx(value);
      if (size != null) parts.push(`font-size: ${size}px`);
    } else if (prop === "font-family") {
      const family = normalizeFontFamily(value);
      if (family) parts.push(`font-family: ${family}`);
    } else if (prop === "margin-left") {
      const mm = parseMarginLeft(value);
      if (mm != null && mm > 0) parts.push(`margin-left: ${mm}px`);
    }
  }
  return parts.join("; ");
}

function parseFontSizePx(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*px$/i.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 8 || n > 48) return null;
  return Math.round(n);
}

function parseMarginLeft(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*px$/i.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > 240) return null;
  return Math.round(n);
}

export function normalizeFontFamily(value: string): WordingFontFamily | null {
  const cleaned = value.replace(/["']/g, "").split(",")[0]?.trim() ?? "";
  if (/times/i.test(cleaned)) return "Times New Roman";
  if (/roboto|sans/i.test(cleaned) || cleaned === "Roboto") return "Roboto";
  return null;
}

/** Strip tags for UI previews, search, and empty checks. */
export function plainTextFromWordingHtml(html: string): string {
  const raw = String(html ?? "");
  if (!raw.trim()) return "";
  if (!looksLikeHtml(raw)) return raw;

  let text = "";
  const tokenRe = /<\/?([a-z0-9]+)[^>]*>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(raw)) !== null) {
    if (match[2] != null) {
      text += decodeEntities(match[2]);
      continue;
    }
    const tag = (match[1] ?? "").toLowerCase();
    const isClose = match[0].startsWith("</");
    if (tag === "br" || (isClose && BLOCK_TAGS.has(tag))) {
      text += "\n";
    } else if (!isClose && (tag === "li" || tag === "p" || tag === "div")) {
      if (text && !text.endsWith("\n")) text += "\n";
    }
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function isWordingHtmlEmpty(value: string): boolean {
  return plainTextFromWordingHtml(value).trim() === "";
}

/**
 * Approximate plain text (with newlines) for pdfme height estimation.
 * List items become separate lines with a bullet/number marker width.
 */
export function wordingHtmlToEstimateText(html: string): string {
  const raw = String(html ?? "");
  if (!raw.trim()) return "";
  if (!looksLikeHtml(raw)) return raw;

  const lines: string[] = [];
  let current = "";
  let listTag: "ul" | "ol" | null = null;
  let listStyle: WordingListStyle | null = null;
  let listIndex = 0;
  let indent = 0;

  const flush = (opts?: { allowEmpty?: boolean }) => {
    const t = current.replace(/\s+/g, " ").trim();
    current = "";
    if (!t) {
      if (opts?.allowEmpty) lines.push("");
      return;
    }
    const pad = "  ".repeat(indent);
    if (listTag && listStyle) {
      listIndex += 1;
      lines.push(`${pad}${formatWordingListMarker(listStyle, listIndex)}${t}`);
    } else {
      lines.push(`${pad}${t}`);
    }
  };

  const tokenRe = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(raw)) !== null) {
    if (match[3] != null) {
      current += decodeEntities(match[3]);
      continue;
    }
    const tag = (match[1] ?? "").toLowerCase();
    const isClose = match[0].startsWith("</");
    const attrs = match[2] ?? "";

    if (tag === "br") {
      if (current.replace(/\s+/g, " ").trim()) flush();
      else flush({ allowEmpty: true });
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      if (!isClose) {
        flush();
        listTag = tag;
        const rawStyle = readAttr(attrs, "data-list-style");
        listStyle =
          rawStyle && isWordingListStyle(rawStyle)
            ? rawStyle
            : defaultListStyleForTag(tag);
        listIndex = 0;
      } else {
        flush();
        listTag = null;
        listStyle = null;
        listIndex = 0;
      }
      continue;
    }
    if (tag === "li") {
      if (!isClose) {
        flush();
        const dataIndent = readAttr(attrs, "data-indent");
        indent = dataIndent ? Math.min(8, Number(dataIndent) || 0) : indent;
        const margin = readAttr(attrs, "style");
        if (margin && /margin-left\s*:\s*(\d+)/i.test(margin)) {
          const px = Number(RegExp.$1);
          indent = Math.min(8, Math.floor(px / 24));
        }
      } else {
        flush();
      }
      continue;
    }
    if (tag === "p" || tag === "div") {
      if (!isClose) {
        flush();
        const dataIndent = readAttr(attrs, "data-indent");
        if (dataIndent) indent = Math.min(8, Number(dataIndent) || 0);
        else {
          const style = readAttr(attrs, "style") ?? "";
          const m = /margin-left\s*:\s*(\d+)/i.exec(style);
          indent = m ? Math.min(8, Math.floor(Number(m[1]) / 24)) : 0;
        }
      } else {
        if (current.replace(/\s+/g, " ").trim()) flush();
        else flush({ allowEmpty: true });
        indent = 0;
      }
    }
  }
  flush();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/** Persist-ready HTML (empty → ""). */
export function normalizeWordingHtmlForSave(value: string): string {
  if (isWordingHtmlEmpty(value)) return "";
  return sanitizeWordingHtml(ensureWordingHtml(value));
}
