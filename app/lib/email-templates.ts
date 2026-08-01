import {
  BROKER_ANNUAL_BODY_HTML,
  BROKER_OWNER_BUILDER_BODY_HTML,
  BROKER_RENEWAL_BODY_HTML,
  BROKER_SINGLE_BODY_HTML,
  INSURER_EMAIL_BODY_HTML,
} from "~/lib/email/default-bodies";
import {
  clampEmailFooterDisplayWidth,
  EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
} from "~/lib/email/footer-display";

export {
  EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
  EMAIL_FOOTER_DISPLAY_WIDTH_MIN,
  EMAIL_FOOTER_DISPLAY_WIDTH_MAX,
  EMAIL_FOOTER_DISPLAY_WIDTH_STEP,
  clampEmailFooterDisplayWidth,
} from "~/lib/email/footer-display";

/** Who the email is sent to (compose dialog / Resend tags). */
export const EMAIL_SEND_RECIPIENTS = ["broker", "insurer"] as const;
export type EmailSendRecipient = (typeof EMAIL_SEND_RECIPIENTS)[number];

/** Stored template slots (Settings → Email templates). */
export const EMAIL_TEMPLATE_KEYS = [
  "insurer",
  "broker_annual",
  "broker_renewal",
  "broker_single",
  "broker_owner_builder",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

/** @deprecated Use EMAIL_TEMPLATE_KEYS / EmailTemplateKey */
export const EMAIL_RECIPIENT_TYPES = EMAIL_TEMPLATE_KEYS;
/** @deprecated Use EmailTemplateKey */
export type EmailRecipientType = EmailTemplateKey;

export type EmailTemplateMeta = {
  key: EmailTemplateKey;
  title: string;
  description: string;
  /** Shown as a badge on the settings card. */
  policyTag: string | null;
  /** ASCX source filename (broker variants). */
  sourceAscx: string | null;
  /** coverTypeId when this broker template applies (1 Annual, 2 Single, 3 OB). */
  coverTypeId: number | null;
  /** policyCategoryId 2 = Renewal; only with Annual for renewal template. */
  requiresRenewalCategory: boolean;
};

export const EMAIL_TEMPLATE_META: Record<EmailTemplateKey, EmailTemplateMeta> =
  {
    insurer: {
      key: "insurer",
      title: "Insurer",
      description: "Sent to the configured insurer email address.",
      policyTag: null,
      sourceAscx: "CARSendToInsurer.ascx",
      coverTypeId: null,
      requiresRenewalCategory: false,
    },
    broker_annual: {
      key: "broker_annual",
      title: "Broker — Annual",
      description: "New annual quotations to the authorised representative.",
      policyTag: "Annual",
      sourceAscx: "CARPolicyAnnual.ascx",
      coverTypeId: 1,
      requiresRenewalCategory: false,
    },
    broker_renewal: {
      key: "broker_renewal",
      title: "Broker — Renewal",
      description: "Annual renewal quotations (policy category Renewal).",
      policyTag: "Renewal",
      sourceAscx: "CARPolicyAnnualRenewal.ascx",
      coverTypeId: 1,
      requiresRenewalCategory: true,
    },
    broker_single: {
      key: "broker_single",
      title: "Broker — Single",
      description:
        "Single project quotations to the authorised representative.",
      policyTag: "Single",
      sourceAscx: "CARPolicySingle.ascx",
      coverTypeId: 2,
      requiresRenewalCategory: false,
    },
    broker_owner_builder: {
      key: "broker_owner_builder",
      title: "Broker — Owner Builder",
      description: "Owner builder quotations to the authorised representative.",
      policyTag: "Owner Builder",
      sourceAscx: "CARPolicyOwnerBuilder.ascx",
      coverTypeId: 3,
      requiresRenewalCategory: false,
    },
  };

export type EmailTemplate = {
  recipientType: EmailTemplateKey;
  subject: string;
  /** TipTap / React Email editor HTML document (may include {{placeholders}}). */
  body: string;
  /** Insurer only. Broker recipients use the client's AR email. */
  toEmail: string;
};

export type EmailTemplateVars = {
  clientName?: string;
  policyNumber?: string;
  brokerName?: string;
  coverType?: string;
  insuredName?: string;
  siteAddress?: string;
  accountManagerName?: string;
  accountManagerArNumber?: string;
  accountManagerPhone?: string;
  accountManagerEmail?: string;
  insurerEmailBody?: string;
  /**
   * Footer image as a data URI blob from `app_email_footer_image`
   * (not an HTTP URL).
   */
  footerImage?: string;
};

export const DEFAULT_EMAIL_TEMPLATES: Record<
  EmailTemplateKey,
  Omit<EmailTemplate, "recipientType">
> = {
  insurer: {
    subject: "CAR policy — {{policyNumber}} — {{clientName}}",
    body: INSURER_EMAIL_BODY_HTML,
    toEmail: "",
  },
  broker_annual: {
    subject: "CAR Annual quotation — {{policyNumber}} — {{insuredName}}",
    body: BROKER_ANNUAL_BODY_HTML,
    toEmail: "",
  },
  broker_renewal: {
    subject: "CAR Annual renewal — {{policyNumber}} — {{insuredName}}",
    body: BROKER_RENEWAL_BODY_HTML,
    toEmail: "",
  },
  broker_single: {
    subject: "CAR Single quotation — {{policyNumber}} — {{insuredName}}",
    body: BROKER_SINGLE_BODY_HTML,
    toEmail: "",
  },
  broker_owner_builder: {
    subject: "CAR Owner Builder quotation — {{policyNumber}} — {{insuredName}}",
    body: BROKER_OWNER_BUILDER_BODY_HTML,
    toEmail: "",
  },
};

/** POLICY_CATEGORY Renewal = 2 (see reference-data). */
const POLICY_CATEGORY_RENEWAL = 2;

/**
 * Pick the broker email template for a policy's cover type + category.
 * Renewal ASCX applies only to Annual + Renewal category.
 */
export function resolveBrokerTemplateKey(input: {
  coverTypeId: number;
  policyCategoryId: number;
}): EmailTemplateKey {
  if (
    input.coverTypeId === 1 &&
    input.policyCategoryId === POLICY_CATEGORY_RENEWAL
  ) {
    return "broker_renewal";
  }
  if (input.coverTypeId === 2) return "broker_single";
  if (input.coverTypeId === 3) return "broker_owner_builder";
  return "broker_annual";
}

export function isBrokerTemplateKey(key: EmailTemplateKey): boolean {
  return key.startsWith("broker_");
}

export function sendRecipientForTemplate(
  key: EmailTemplateKey,
): EmailSendRecipient {
  return key === "insurer" ? "insurer" : "broker";
}

const PLACEHOLDER_KEYS = [
  "clientName",
  "policyNumber",
  "brokerName",
  "coverType",
  "insuredName",
  "siteAddress",
  "accountManagerName",
  "accountManagerArNumber",
  "accountManagerPhone",
  "accountManagerEmail",
  "insurerEmailBody",
  "footerImage",
] as const satisfies ReadonlyArray<keyof EmailTemplateVars>;

/** Click-to-insert tokens for the template editor. */
export const EMAIL_TEMPLATE_PLACEHOLDERS = PLACEHOLDER_KEYS.map((key) => ({
  key,
  token: `{{${key}}}`,
  label: key,
}));

const PLACEHOLDER_FALLBACKS: Record<(typeof PLACEHOLDER_KEYS)[number], string> =
  {
    clientName: "Client",
    policyNumber: "",
    brokerName: "Broker",
    coverType: "",
    insuredName: "",
    siteAddress: "",
    accountManagerName: "",
    accountManagerArNumber: "",
    accountManagerPhone: "",
    accountManagerEmail: "",
    insurerEmailBody: "",
    /** Prefer the DB blob from `getEmailFooterDataUri()`; this is a last-resort empty img. */
    footerImage: "",
  };

/** Merge fields for the client's assigned account manager (email signature). */
export function emailVarsFromAccountManager(
  manager:
    | {
        fullName?: string | null;
        arNumber?: string | null;
        mobile?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
): Pick<
  EmailTemplateVars,
  | "accountManagerName"
  | "accountManagerArNumber"
  | "accountManagerPhone"
  | "accountManagerEmail"
> {
  return {
    accountManagerName: manager?.fullName?.trim() ?? "",
    accountManagerArNumber: manager?.arNumber?.trim() ?? "",
    accountManagerPhone: manager?.mobile?.trim() ?? "",
    accountManagerEmail: manager?.email?.trim() ?? "",
  };
}

export function applyEmailTemplate(
  template: string,
  vars: EmailTemplateVars,
): string {
  let result = template;
  for (const key of PLACEHOLDER_KEYS) {
    const value = vars[key]?.trim() || PLACEHOLDER_FALLBACKS[key];
    result = result.replaceAll(`{{${key}}}`, value);
    // TipTap / browser may URL-encode placeholders inside attributes (e.g. img src).
    result = result.replaceAll(`%7B%7B${key}%7D%7D`, value);
    result = result.replaceAll(`%7b%7b${key}%7d%7d`, value);
  }

  // TipTap resolves placeholder img src to an absolute URL; rewrite those back.
  const footer = vars.footerImage?.trim() || PLACEHOLDER_FALLBACKS.footerImage;
  if (footer) {
    result = result.replace(
      /(?:src|href)=["'][^"']*(?:\{\{footerImage(?:Url)?\}\}|%7B%7BfooterImage(?:Url)?%7D%7D)[^"']*["']/gi,
      `src="${footer}"`,
    );
    // Legacy token from earlier builds.
    result = result.replaceAll("{{footerImageUrl}}", footer);
    result = result.replaceAll("%7B%7BfooterImageUrl%7D%7D", footer);
    result = result.replaceAll("%7b%7bfooterImageUrl%7d%7d", footer);
  }

  return result;
}

function isEmailFooterLogoImgAttrs(attrs: string, dataUri = ""): boolean {
  if (/alt\s*=\s*["']Irecon Advisernet Logo["']/i.test(attrs)) return true;
  if (/\{\{footerImage(?:Url)?\}\}/i.test(attrs)) return true;
  if (/%7B%7BfooterImage(?:Url)?%7D%7D/i.test(attrs)) return true;
  if (dataUri && attrs.includes(dataUri)) return true;
  return false;
}

/** Set width / max-width on the Advisernet footer logo `<img>`. */
export function applyEmailFooterImageWidth(
  html: string,
  widthPx: number,
  dataUri = "",
): string {
  const w = clampEmailFooterDisplayWidth(widthPx);
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    if (!isEmailFooterLogoImgAttrs(attrs, dataUri)) return full;
    let next = String(attrs).replace(/\swidth\s*=\s*["'][^"']*["']/i, "");
    next = next.replace(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i, (_m, q, value) => {
      const cleaned = String(value)
        .replace(/\bwidth\s*:\s*[^;]+;?/gi, "")
        .replace(/\bmax-width\s*:\s*[^;]+;?/gi, "")
        .replace(/\bheight\s*:\s*[^;]+;?/gi, "")
        .trim();
      return cleaned ? ` style=${q}${cleaned}${q}` : "";
    });
    next = upsertInlineStyle(
      next,
      `display:block;width:${w}px;max-width:100%;height:auto`,
    );
    return `<img${next} width="${w}">`;
  });
}

/** Swap `{{footerImage}}` (and TipTap-mangled / legacy forms) for the DB data URI. */
export function injectEmailFooterImage(
  html: string,
  dataUri: string,
  displayWidthPx: number = EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
): string {
  if (!dataUri.trim()) return html;
  let result = html.replaceAll("{{footerImage}}", dataUri);
  result = result.replaceAll("{{footerImageUrl}}", dataUri);
  result = result.replaceAll("%7B%7BfooterImage%7D%7D", dataUri);
  result = result.replaceAll("%7B%7BfooterImageUrl%7D%7D", dataUri);
  result = result.replaceAll("%7b%7bfooterImage%7d%7d", dataUri);
  result = result.replaceAll("%7b%7bfooterImageUrl%7d%7d", dataUri);
  result = result.replace(
    /(?:src|href)=["'][^"']*(?:\{\{footerImage(?:Url)?\}\}|%7B%7BfooterImage(?:Url)?%7D%7D)[^"']*["']/gi,
    `src="${dataUri}"`,
  );
  return applyEmailFooterImageWidth(result, displayWidthPx, dataUri);
}

/** When saving, put the token back so templates stay portable. */
export function extractEmailFooterImage(html: string, dataUri: string): string {
  if (!dataUri.trim()) return html;
  return html.replaceAll(dataUri, "{{footerImage}}");
}

/** @deprecated Use the DB data URI from `getEmailFooterDataUri()` / loader. */
export function emailFooterImageUrl(_origin?: string): string {
  return "";
}

/** Sample merge fields for Settings → Email template preview / test send. */
export function emailTemplatePreviewVars(options?: {
  footerImageDataUri?: string;
}): Required<EmailTemplateVars> {
  // Values must be unique so Visual edits can reverse-map back to {{tokens}}.
  return {
    clientName: "Acme Constructions Pty Ltd",
    policyNumber: "ATCCW1234",
    brokerName: "Jane Broker",
    coverType: "Annual Cover",
    insuredName: "Acme Insured Pty Ltd",
    siteAddress: "10 Example St, Sydney NSW 2000",
    accountManagerName: "Loretta Casey",
    accountManagerArNumber: "Authorised Representative No. 1239170",
    accountManagerPhone: "0499 221 761",
    accountManagerEmail: "lcasey@irecon.com.au",
    insurerEmailBody:
      "Please bind this risk at your earliest convenience. Sample referral notes for preview.",
    footerImage: options?.footerImageDataUri ?? "",
  };
}

/**
 * Reverse of applyEmailTemplate — restore {{placeholders}} after editing a
 * sample-filled Visual iframe. Longer values replaced first.
 */
export function dematerializeEmailTemplate(
  html: string,
  vars: EmailTemplateVars,
): string {
  let result = html;
  const footer = vars.footerImage?.trim() || "";
  if (footer) {
    result = result.replaceAll(footer, "{{footerImage}}");
  }

  const entries = PLACEHOLDER_KEYS.map((key) => {
    const value = (vars[key]?.trim() || PLACEHOLDER_FALLBACKS[key]).trim();
    return [key, value] as const;
  })
    .filter(([key, value]) => key !== "footerImage" && value.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [key, value] of entries) {
    result = result.replaceAll(value, `{{${key}}}`);
  }
  return result;
}

/**
 * Wrap `{{tokens}}` in text nodes as styled spans for Visual/Preview.
 * Skips attribute values (e.g. mailto:{{accountManagerEmail}}).
 */
export function wrapEmailPlaceholderTags(html: string): string {
  return html.replace(
    /(<[^>]+>)|([^<]+)/g,
    (full, tag: string, text: string) => {
      if (tag) return tag;
      return text.replace(
        /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g,
        '<span class="email-placeholder-tag" data-email-placeholder="$1">{{$1}}</span>',
      );
    },
  );
}

/** Strip Visual placeholder chrome back to plain `{{tokens}}`. */
export function unwrapEmailPlaceholderTags(html: string): string {
  return html
    .replace(
      /<span\b[^>]*\bdata-email-placeholder=["']([a-zA-Z][a-zA-Z0-9_]*)["'][^>]*>\s*\{\{\1\}\}\s*<\/span>/gi,
      "{{$1}}",
    )
    .replace(
      /<span\b[^>]*\bclass=["'][^"']*email-placeholder-tag[^"']*["'][^>]*>\s*\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}\s*<\/span>/gi,
      "{{$1}}",
    );
}

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
function parseStyleDeclarations(
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

function serializeStyleDeclarations(
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

function rewriteStyleAttributes(
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
