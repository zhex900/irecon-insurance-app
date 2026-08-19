import {
  applyEmailFooterImageWidth,
  applyEmailTemplate,
  EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
  type EmailTemplateVars,
} from "~/lib/email/template-core";

export function isEmailHtmlBody(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body.trim());
}

/**
 * React Email `getEmail()` drops TipTap `tableHeader` (`<th>`) nodes.
 * Rewrite label headers to styled `<td>` so export / preview keep the box.
 */
export function convertEmailTableHeadersToCells(html: string): string {
  return html
    .replace(/<th(\s[^>]*)?>/gi, (_match, attrs: string | undefined = "") => {
      const cleaned = String(attrs).replace(
        /\sstyle\s*=\s*(["'])[\s\S]*?\1/i,
        "",
      );
      return `<td${cleaned} style="background:#808080;color:#ffffff;font-weight:700;border:1px solid #808080;padding:4px 8px;width:9rem;vertical-align:top">`;
    })
    .replace(/<\/th>/gi, "</td>");
}

function isZeroBorderWidth(value: string): boolean {
  return /^(0|0px|0pt|0em|0%)$/i.test(value.trim());
}

function isBorderDecl(prop: string): boolean {
  return /^border\b/i.test(prop.trim());
}

function isBorderShorthandProp(prop: string): boolean {
  return /^(border|border-(top|right|bottom|left))$/i.test(prop.trim());
}

function isBorderWidthProp(prop: string): boolean {
  return /^(border-width|border-(top|right|bottom|left)-width)$/i.test(
    prop.trim(),
  );
}

/**
 * Detect a positive border width in a CSS border shorthand.
 * Supports both modern (`1px solid gray`) and Word/legacy (`dotted gray 1.0pt`)
 * token order — width is not always first.
 */
function borderShorthandHasPositiveWidth(value: string): boolean {
  const v = value.trim();
  if (!v || /^none$/i.test(v)) return false;

  const lengths = v.match(/\d*\.?\d+(?:px|pt|em|rem|%)/gi) ?? [];
  if (lengths.length > 0) {
    return lengths.some((length) => !isZeroBorderWidth(length));
  }

  // Bare leading number without unit (e.g. `1 solid black`).
  const first = v.split(/\s+/)[0] ?? "";
  return /^\d/.test(first) && !isZeroBorderWidth(first);
}

/** Keyword widths only count when style isn't `none` (TipTap emits `medium` + `none`). */
function hasVisibleBorderWidth(
  decls: Array<{ prop: string; value: string }>,
): boolean {
  const styleNone = new Set<string>();
  for (const { prop, value } of decls) {
    const p = prop.toLowerCase();
    if (p === "border-style" && /^none$/i.test(value.trim())) {
      styleNone.add("border");
    }
    const side = p.match(/^border-(top|right|bottom|left)-style$/i)?.[1];
    if (side && /^none$/i.test(value.trim())) {
      styleNone.add(`border-${side.toLowerCase()}`);
    }
  }

  for (const { prop, value } of decls) {
    if (isBorderShorthandProp(prop)) {
      if (borderShorthandHasPositiveWidth(value)) return true;
      continue;
    }
    if (!isBorderWidthProp(prop)) continue;
    if (!value.trim() || isZeroBorderWidth(value)) continue;

    const p = prop.toLowerCase();
    if (p === "border-width") {
      if (!styleNone.has("border")) return true;
      continue;
    }
    const side = p.match(/^border-(top|right|bottom|left)-width$/i)?.[1];
    if (side && !styleNone.has(`border-${side.toLowerCase()}`)) return true;
  }
  return false;
}

/** Split `style` attribute into prop/value pairs (best-effort). */
export function parseStyleDeclarations(
  style: string,
): Array<{ prop: string; value: string }> {
  return style
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(":");
      if (idx === -1) return null;
      return {
        prop: part.slice(0, idx).trim(),
        value: part.slice(idx + 1).trim(),
      };
    })
    .filter((d): d is { prop: string; value: string } => Boolean(d));
}

export function serializeStyleDeclarations(
  decls: Array<{ prop: string; value: string }>,
): string {
  return decls.map(({ prop, value }) => `${prop}: ${value}`).join("; ");
}

/**
 * TipTap inspector often leaves `border-style: solid` after setting width to 0.
 * React Email then paints boxes in the received message. Normalize zeros to an
 * explicit `border: none` so the user's choice is saved and honored on send.
 *
 * Must understand Word/legacy shorthands like `border: dotted gray 1.0pt`
 * where the width token is not first — otherwise those get wiped to `none`.
 */
export function sanitizeZeroAndOrphanBorders(style: string): string {
  const decls = parseStyleDeclarations(style);
  if (decls.length === 0) return "";

  const hasPositiveWidth = hasVisibleBorderWidth(decls);
  const nonBorder = decls.filter(({ prop }) => !isBorderDecl(prop));

  // No positive width → persist explicit none (do not drop, or CSS defaults return).
  if (!hasPositiveWidth) {
    const hadAnyBorder = decls.some(({ prop }) => isBorderDecl(prop));
    if (!hadAnyBorder) return serializeStyleDeclarations(decls);
    return serializeStyleDeclarations([
      ...nonBorder,
      { prop: "border", value: "none" },
    ]);
  }

  // Keep positive borders and explicit `none` side overrides (Word shared
  // edges: `border: dotted …; border-left: none`). Drop only zero-width.
  const cleaned = decls.filter(({ prop, value }) => {
    if (isBorderShorthandProp(prop)) {
      const v = value.trim();
      if (/^none$/i.test(v)) return true;
      return borderShorthandHasPositiveWidth(v);
    }
    if (isBorderWidthProp(prop)) {
      return !isZeroBorderWidth(value);
    }
    // Drop orphan border-style/color/image when width is none/zero elsewhere —
    // keep them when we already know a visible width exists.
    return true;
  });

  return serializeStyleDeclarations(cleaned);
}

export function rewriteStyleAttributes(
  html: string,
  rewrite: (style: string) => string,
): string {
  return html.replace(
    /\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi,
    (_match, quote: string, style: string) => {
      const next = rewrite(style).trim();
      if (!next) return "";
      return ` style=${quote}${next}${quote}`;
    },
  );
}

function readHtmlAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["']?)([^"'\\s>]*)\\1`, "i");
  const match = re.exec(attrs);
  return match?.[2] ?? null;
}

function upsertInlineStyle(attrs: string, declarations: string): string {
  const prefix = declarations.trim().replace(/;?$/, ";");
  if (/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.test(attrs)) {
    return attrs.replace(
      /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
      (_m, q: string, value: string) => ` style=${q}${prefix}${value}${q}`,
    );
  }
  return `${attrs} style="${prefix}"`;
}

function cellHasPadding(attrs: string): boolean {
  const styleMatch = /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(attrs);
  if (!styleMatch) return false;
  return /(^|;)\s*padding\s*:/i.test(styleMatch[2]);
}

/**
 * Copy obsolete `cellpadding` / `cellspacing` into inline CSS so Tailwind
 * preflight (and email clients) render the same. App CSS `padding: 0` otherwise
 * kills `cellpadding`, while real inboxes still honor it — editor looked
 * tighter than the sent message.
 */
export function materializeEmailTableAttrs(html: string): string {
  return html.replace(
    /<table\b([^>]*)>([\s\S]*?)<\/table>/gi,
    (full, attrs: string, inner: string) => {
      const cellpadding = readHtmlAttr(attrs, "cellpadding");
      const cellspacing = readHtmlAttr(attrs, "cellspacing");
      let nextAttrs = attrs;
      let nextInner = inner;

      if (cellspacing != null && /^\d+$/.test(cellspacing)) {
        if (!/border-spacing\s*:/i.test(nextAttrs)) {
          nextAttrs = upsertInlineStyle(
            nextAttrs,
            `border-spacing:${cellspacing}px`,
          );
        }
      }

      if (cellpadding != null && /^\d+$/.test(cellpadding)) {
        const pad = `padding:${cellpadding}px`;
        nextInner = nextInner.replace(
          /<(td|th)\b([^>]*)>/gi,
          (cell, tag: string, cellAttrs: string) => {
            if (cellHasPadding(cellAttrs)) return cell;
            return `<${tag}${upsertInlineStyle(cellAttrs, pad)}>`;
          },
        );
      }

      if (nextAttrs === attrs && nextInner === inner) return full;
      return `<table${nextAttrs}>${nextInner}</table>`;
    },
  );
}

/** Base face matching legacy ASCX `body, td { font: Arial 10pt }` — used in CSS + wrap. */
export const EMAIL_DOCUMENT_BASE_STYLE =
  "font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: normal; color: #000000;";

/**
 * Shared document chrome for TipTap canvas + Preview iframe so both paint the
 * same. Keep in sync with `.email-rich-editor .tiptap` in app.css.
 */
export const EMAIL_DOCUMENT_SURFACE_CSS = `
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  line-height: normal;
  color: #000;
  background: #fff;
`.trim();

/**
 * Minimal chrome for the Visual/Preview iframe. Do not zero `p` margins or
 * force `border-collapse` — that made the editor tighter than real inboxes
 * (which honor ASCX `cellpadding` / default paragraph spacing).
 */
export const EMAIL_DOCUMENT_ELEMENT_CSS = `
  a { color: #0670db; text-decoration: underline; }
  th, td { vertical-align: top; }
  img { max-width: 100%; height: auto; }
`.trim();

/** Wrap outbound/preview HTML so clients get the same base face as the editor. */
export function wrapEmailDocumentHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;
  if (/\bdata-irecon-email-root\b/i.test(trimmed)) return trimmed;
  return `<div data-irecon-email-root="1" style="${EMAIL_DOCUMENT_BASE_STYLE}">${trimmed}</div>`;
}

/**
 * Preview HTML that matches the Visual/Code editor surface — no ASCX rewrite
 * pipeline (that made Preview diverge from TipTap).
 */
export function buildEditorMatchedPreviewHtml(
  documentHtml: string,
  vars: EmailTemplateVars,
): string {
  return wrapEmailDocumentHtml(applyEmailTemplate(documentHtml.trim(), vars));
}

/**
 * Outbound / Preview HTML for authored ASCX templates.
 * Same light path as Settings → Preview (no TipTap / preferEmailHtml rewrites).
 */
export function buildOutboundTemplateHtml(
  bodyHtml: string,
  options?: {
    footerImageDataUri?: string;
    footerImageWidth?: number;
  },
): string {
  return applyEmailFooterImageWidth(
    materializeEmailTableAttrs(bodyHtml.trim()),
    options?.footerImageWidth ?? EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
    options?.footerImageDataUri ?? "",
  );
}

/**
 * Normalize borders for save / preview / send without overriding the author's
 * choices. Preserves dotted/dashed (legacy ASCX / notice callouts). Only
 * collapses TipTap zero-width orphan borders to explicit `border: none`.
 */
export function ensureEmailTableBorders(html: string): string {
  let result = materializeEmailTableAttrs(html);

  result = rewriteStyleAttributes(result, (style) =>
    sanitizeZeroAndOrphanBorders(style),
  );

  result = result.replace(
    /<table(\s[^>]*)?>/gi,
    (match, attrs: string | undefined = "") => {
      // \b — style="border-collapse:…" has no leading space before the prop.
      if (/\bborder-collapse\s*:/i.test(match)) return match;
      // Leave ASCX notice callouts alone (dashed/dotted outer border).
      if (/\bborder\s*:[^;"]*(dashed|dotted)/i.test(match)) return match;
      if (/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.test(attrs)) {
        return `<table${attrs.replace(
          /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
          (_m, q: string, value: string) =>
            ` style=${q}border-collapse:collapse;${value}${q}`,
        )}>`;
      }
      return `<table${attrs} style="border-collapse:collapse">`;
    },
  );

  return result;
}

/** Ensure list markers survive Tailwind preflight and React Email theme gaps. */
export function ensureEmailListStyles(html: string): string {
  return html
    .replace(/<ul(\s[^>]*)?>/gi, (match, attrs: string | undefined = "") => {
      // Use \b — TipTap's style="list-style-type:…" has no space before the prop.
      if (/\blist-style-type\s*:/i.test(match)) return match;
      if (/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.test(attrs)) {
        return `<ul${attrs.replace(
          /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
          (_m, q: string, value: string) =>
            ` style=${q}list-style-type:disc;${value}${q}`,
        )}>`;
      }
      return `<ul${attrs} style="list-style-type:disc">`;
    })
    .replace(/<ol(\s[^>]*)?>/gi, (match, attrs: string | undefined = "") => {
      if (/\blist-style-type\s*:/i.test(match)) return match;
      if (/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.test(attrs)) {
        return `<ol${attrs.replace(
          /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
          (_m, q: string, value: string) =>
            ` style=${q}list-style-type:decimal;${value}${q}`,
        )}>`;
      }
      return `<ol${attrs} style="list-style-type:decimal">`;
    });
}

function splitCssBoxValues(value: string): [string, string, string, string] {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", "", "", ""];
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  return [parts[0], parts[1], parts[2], parts[3]];
}

/**
 * TipTap expands `border: dotted gray 1.0pt; border-left: none` into longhands
 * with `medium`/`currentcolor`. Collapse back to ASCX-like shorthands.
 */
export function collapseExpandedBorderStyles(style: string): string {
  const decls = parseStyleDeclarations(style);
  const byProp = new Map(
    decls.map((d) => [d.prop.toLowerCase(), d.value] as const),
  );

  const widthRaw = byProp.get("border-width");
  const styleRaw = byProp.get("border-style");
  const colorRaw = byProp.get("border-color");
  if (!widthRaw || !styleRaw) {
    return serializeStyleDeclarations(decls);
  }

  const widths = splitCssBoxValues(widthRaw);
  const styles = splitCssBoxValues(styleRaw);
  const colors = splitCssBoxValues(colorRaw ?? "gray");
  const sides = ["top", "right", "bottom", "left"] as const;
  const sideValues = sides.map((side, i) => {
    const s = styles[i] ?? "none";
    if (/^none$/i.test(s)) return "none";
    const w = (widths[i] ?? "1pt").replace(/medium/i, "1pt");
    const c = (colors[i] ?? "gray").replace(/currentcolor/i, "gray");
    // Word/ASCX order: style color width
    return `${s} ${c} ${w}`;
  });

  const nonBorder = decls.filter(({ prop }) => {
    const p = prop.toLowerCase();
    if (p === "border-collapse") return true;
    return p !== "border" && !p.startsWith("border-");
  });

  const unique = [...new Set(sideValues)];
  const next: Array<{ prop: string; value: string }> = [...nonBorder];

  if (unique.length === 1) {
    next.push({ prop: "border", value: unique[0]! });
  } else {
    const counts = new Map<string, number>();
    for (const v of sideValues) counts.set(v, (counts.get(v) ?? 0) + 1);
    let dominant = sideValues[0]!;
    let best = 0;
    for (const [v, n] of counts) {
      if (n > best) {
        dominant = v;
        best = n;
      }
    }
    if (best >= 2 && dominant !== "none") {
      next.push({ prop: "border", value: dominant });
      sides.forEach((side, i) => {
        if (sideValues[i] !== dominant) {
          next.push({ prop: `border-${side}`, value: sideValues[i]! });
        }
      });
    } else {
      sides.forEach((side, i) => {
        next.push({ prop: `border-${side}`, value: sideValues[i]! });
      });
    }
  }

  return serializeStyleDeclarations(next);
}

/**
 * Undo TipTap / pipeline rewrites so outbound HTML matches legacy ASCX style.
 */
