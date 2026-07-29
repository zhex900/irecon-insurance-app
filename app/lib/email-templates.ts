import {
  BROKER_ANNUAL_BODY_HTML,
  BROKER_OWNER_BUILDER_BODY_HTML,
  BROKER_RENEWAL_BODY_HTML,
  BROKER_SINGLE_BODY_HTML,
  INSURER_EMAIL_BODY_HTML,
} from "~/lib/email/default-bodies";

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

/** Swap `{{footerImage}}` (and TipTap-mangled / legacy forms) for the DB data URI. */
export function injectEmailFooterImage(html: string, dataUri: string): string {
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
  return result;
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
  return {
    clientName: "Acme Constructions Pty Ltd",
    policyNumber: "ATCCW1234",
    brokerName: "Jane Broker",
    coverType: "Annual",
    insuredName: "Acme Constructions Pty Ltd",
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
 */
export function sanitizeZeroAndOrphanBorders(style: string): string {
  const decls = parseStyleDeclarations(style);
  if (decls.length === 0) return "";

  let hasPositiveWidth = false;

  for (const { prop, value } of decls) {
    const p = prop.toLowerCase();
    if (p === "border") {
      const widthToken = value.trim().split(/\s+/)[0] ?? "";
      if (
        !/^none$/i.test(value.trim()) &&
        /^\d/.test(widthToken) &&
        !isZeroBorderWidth(widthToken)
      ) {
        hasPositiveWidth = true;
      }
      continue;
    }
    if (
      p === "border-width" ||
      /^border-(top|right|bottom|left)-width$/i.test(p)
    ) {
      if (value.trim() && !isZeroBorderWidth(value)) hasPositiveWidth = true;
    }
  }

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

  // Keep positive borders; drop zero-width shorthands / widths.
  const cleaned = decls.filter(({ prop, value }) => {
    const p = prop.toLowerCase();
    if (p === "border") {
      const widthToken = value.trim().split(/\s+/)[0] ?? "";
      return !(/^none$/i.test(value.trim()) || isZeroBorderWidth(widthToken));
    }
    if (
      p === "border-width" ||
      /^border-(top|right|bottom|left)-width$/i.test(p)
    ) {
      return !isZeroBorderWidth(value);
    }
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

/**
 * Normalize borders for save / preview / send without overriding the author's
 * choices. Converts dotted→solid for clients, and zeros→`border: none` so
 * inspector "0" actually persists.
 */
export function ensureEmailTableBorders(html: string): string {
  let result = rewriteStyleAttributes(html, (style) => {
    const next = style
      .replace(/\bborder(\s*:\s*[^;"']*?)\bdotted\b/gi, "border$1solid")
      .replace(/\bborder(\s*:\s*[^;"']*?)\bdashed\b/gi, "border$1solid")
      .replace(/\bborder-style\s*:\s*dotted\b/gi, "border-style:solid")
      .replace(/\bborder-style\s*:\s*dashed\b/gi, "border-style:solid")
      .replace(
        /\bborder-(top|right|bottom|left)-style\s*:\s*(?:dotted|dashed)\b/gi,
        "border-$1-style:solid",
      );
    return sanitizeZeroAndOrphanBorders(next);
  });

  result = result.replace(
    /<table(\s[^>]*)?>/gi,
    (match, attrs: string | undefined = "") => {
      if (/border-collapse\s*:/i.test(match)) return match;
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
      if (/\slist-style-type\s*:/i.test(match)) return match;
      if (/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.test(attrs)) {
        return `<ul${attrs.replace(
          /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
          (_m, q: string, value: string) =>
            ` style=${q}list-style-type:disc;padding-left:1.5em;${value}${q}`,
        )}>`;
      }
      return `<ul${attrs} style="list-style-type:disc;padding-left:1.5em">`;
    })
    .replace(/<ol(\s[^>]*)?>/gi, (match, attrs: string | undefined = "") => {
      if (/\slist-style-type\s*:/i.test(match)) return match;
      if (/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.test(attrs)) {
        return `<ol${attrs.replace(
          /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
          (_m, q: string, value: string) =>
            ` style=${q}list-style-type:decimal;padding-left:1.5em;${value}${q}`,
        )}>`;
      }
      return `<ol${attrs} style="list-style-type:decimal;padding-left:1.5em">`;
    });
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
}): string {
  const normalize = (html: string) =>
    ensureEmailTableBorders(
      ensureEmailListStyles(convertEmailTableHeadersToCells(html.trim())),
    );

  const fromDoc = normalize(options.documentHtml);
  const exported = options.exportedHtml?.trim();
  if (!exported) return fromDoc;

  const fromEmail = normalize(exported);
  const footer = options.footerImageDataUri?.trim();
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

  if (!emailHasImage || emailLostTable || emailLostLabel) return fromDoc;
  return fromEmail;
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
