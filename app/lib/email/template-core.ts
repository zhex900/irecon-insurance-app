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

function upsertInlineStyle(attrs: string, declarations: string): string {
  const prefix = declarations.trim().replace(/;?$/, ";");
  if (/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.test(attrs)) {
    return attrs.replace(
      /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i,
      (_match, quote: string, value: string) =>
        ` style=${quote}${prefix}${value}${quote}`,
    );
  }
  return `${attrs} style="${prefix}"`;
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
