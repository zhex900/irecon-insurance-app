import {
  EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
  applyEmailFooterImageWidth,
} from "~/lib/email/template-core";
import {
  collapseExpandedBorderStyles,
  convertEmailTableHeadersToCells,
  ensureEmailListStyles,
  ensureEmailTableBorders,
  isEmailHtmlBody,
  parseStyleDeclarations,
  rewriteStyleAttributes,
  serializeStyleDeclarations,
  wrapEmailDocumentHtml,
} from "~/lib/email/template-formatting";
export function normalizeOutboundEmailHtml(html: string): string {
  let result = html;

  // TipTap wraps list items in <p> — legacy ASCX does not.
  result = result.replace(
    /<li(\s[^>]*)?>\s*<p(\s[^>]*)?>([\s\S]*?)<\/p>\s*<\/li>/gi,
    "<li$1>$3</li>",
  );

  // Empty spacer paragraphs between blocks → <br> (ASCX uses <br> after notice).
  result = result.replace(
    /<\/table>\s*<p(?:\s[^>]*)?>\s*(?:<br\s*\/?>)?\s*<\/p>\s*<table/gi,
    "</table><br><table",
  );
  result = result.replace(/<p(?:\s[^>]*)?>\s*<br\s*\/?>\s*<\/p>/gi, "<br>");
  result = result.replace(/<p(?:\s[^>]*)?>\s*<\/p>/gi, "");

  // Collapse TipTap expanded borders; drop border-image noise.
  result = rewriteStyleAttributes(result, (style) => {
    let next = style.replace(/\bborder-image\s*:\s*[^;]+;?/gi, "");
    if (/\bborder-width\s*:/i.test(next) && /\bborder-style\s*:/i.test(next)) {
      next = collapseExpandedBorderStyles(next);
    }
    return next;
  });

  // Prefer hex callout colors like ASCX / Gmail source.
  result = result
    .replace(/rgb\(\s*255\s*,\s*255\s*,\s*204\s*\)/gi, "#FFFFCC")
    .replace(/rgb\(\s*255\s*,\s*192\s*,\s*0\s*\)/gi, "#FFC000");

  // Notice callouts: drop TipTap-forced collapse/spacing (ASCX omits them).
  result = result.replace(/<table\b([^>]*)>/gi, (full, attrs: string) => {
    if (!/\bborder\s*:[^;"']*dashed/i.test(attrs)) return full;
    const cleaned = attrs
      .replace(/\bborder-collapse\s*:\s*[^;]+;?/gi, "")
      .replace(/\bborder-spacing\s*:\s*[^;]+;?/gi, "")
      .replace(/\sstyle=(["'])\s*;?\s*\1/gi, "")
      .replace(/\sstyle=(["']);+\s*/gi, " style=$1");
    return `<table${cleaned}>`;
  });

  // TipTap often injects padding-left on lists; ASCX uses margin-left / defaults.
  result = rewriteStyleAttributes(result, (style) => {
    if (!/\blist-style-type\s*:/i.test(style)) return style;
    return style.replace(/\bpadding-left\s*:\s*1\.5em;?/gi, "").trim();
  });

  // Notice / label cells: unwrap TipTap <p><em><strong>… back to <strong><i>.
  result = result.replace(
    /<td(\s[^>]*)?>\s*<p(?:\s[^>]*)?>\s*<em>\s*<strong>([\s\S]*?)<\/strong>\s*<\/em>\s*<\/p>\s*<\/td>/gi,
    "<td$1><strong><i>$2</i></strong></td>",
  );

  // Recover mailto when TipTap/ASCX mangled href but link text is an email.
  result = result.replace(
    /<a\b([^>]*?)\bhref=(["'])mailto:%3C%25[\s\S]*?\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, pre: string, _q: string, post: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return full;
      return `<a${pre}href="mailto:${text}"${post}>${inner}</a>`;
    },
  );

  // Footer logo: never float — float pulls "Important Notices" onto the same
  // line in Preview/iframe while TipTap (no float) stacks them. Keep stacked.
  result = result.replace(
    /<img\b([^>]*?\balt=(["'])Irecon Advisernet Logo\2)([^>]*)>/gi,
    (full, pre: string, _q: string, post: string) => {
      const attrs = `${pre}${post}`.replace(
        /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
        (_m, q: string, value: string) => {
          const cleaned = value
            .replace(/\bfloat\s*:\s*[^;]+;?/gi, "")
            .replace(/\bmargin-right\s*:\s*10px;?/gi, "")
            .trim();
          return cleaned ? ` style=${q}${cleaned}${q}` : "";
        },
      );
      return `<img${attrs}>`;
    },
  );

  // Ensure notices sit below the logo even if older HTML still has float.
  result = result.replace(
    /<table\b([^>]*)>([\s\S]*?Important Notices:[\s\S]*?<\/table>)/gi,
    (full, attrs: string, rest: string) => {
      if (/\bclear\s*:/i.test(attrs)) return full;
      if (/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.test(attrs)) {
        return `<table${attrs.replace(
          /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
          (_m, q: string, value: string) =>
            ` style=${q}clear:both;${value}${q}`,
        )}>${rest}`;
      }
      return `<table${attrs} style="clear:both">${rest}`;
    },
  );

  // Deduplicate repeated list-style-type in one style attr.
  result = rewriteStyleAttributes(result, (style) => {
    const decls = parseStyleDeclarations(style);
    const seen = new Set<string>();
    const unique = decls.filter(({ prop }) => {
      const key = prop.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return serializeStyleDeclarations(unique);
  });

  return result;
}

/**
 * Pick HTML for preview / send: prefer React Email export, but fall back to
 * TipTap document HTML when export drops tables, headers, or images.
 * Always normalize lists/table borders so preview matches the outbound message.
 */
export function preferEmailHtml(options: {
  documentHtml: string;
  exportedHtml?: string | null;
  footerImageDataUri?: string;
  footerImageWidth?: number;
}): string {
  const normalize = (html: string) =>
    normalizeOutboundEmailHtml(
      ensureEmailTableBorders(
        ensureEmailListStyles(convertEmailTableHeadersToCells(html.trim())),
      ),
    );

  const fromDoc = normalize(options.documentHtml);
  const exported = options.exportedHtml?.trim();
  const footer = options.footerImageDataUri?.trim() ?? "";
  const width = options.footerImageWidth ?? EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT;

  const finish = (html: string) =>
    wrapEmailDocumentHtml(applyEmailFooterImageWidth(html, width, footer));

  if (!exported) return finish(fromDoc);

  const fromEmail = normalize(exported);
  const emailHasImage =
    fromEmail.includes("data:image") ||
    !footer ||
    !fromDoc.includes("data:image");
  const emailLostTable =
    /<table[\s>]/i.test(fromDoc) && !/<table[\s>]/i.test(fromEmail);
  const emailLostLabel =
    /(quotation number|policy number|cover type|insured name)/i.test(fromDoc) &&
    !/(quotation number|policy number|cover type|insured name)/i.test(
      fromEmail,
    );
  // TipTap/theme can paint backgrounds in the editor that React Email export drops.
  const emailLostBackground =
    /background(?:-color)?\s*:/i.test(fromDoc) &&
    !/background(?:-color)?\s*:/i.test(fromEmail);
  const emailLostDecorativeBorder =
    /\bborder\s*:[^;]*(dashed|dotted)/i.test(fromDoc) &&
    !/\bborder\s*:[^;]*(dashed|dotted)/i.test(fromEmail);

  const chosen =
    !emailHasImage ||
    emailLostTable ||
    emailLostLabel ||
    emailLostBackground ||
    emailLostDecorativeBorder
      ? fromDoc
      : fromEmail;

  return finish(chosen);
}

export function ensureEmailEditorHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "<p></p>";
  if (isEmailHtmlBody(trimmed)) {
    return ensureEmailTableBorders(convertEmailTableHeadersToCells(trimmed));
  }
  const escaped = trimmed
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `<p>${escaped.replaceAll("\n", "<br>")}</p>`;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
