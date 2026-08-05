import { Resend } from "resend";
import { ExternalServiceError } from "~/lib/errors";

export type SendEmailAttachment = {
  filename: string;
  /** Base64-encoded file content (raw base64, no data: prefix). */
  content: string;
  contentType?: string;
  /** Inline image Content-ID (use `src="cid:…"` in HTML). */
  contentId?: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  cc?: string | string[];
  replyTo?: string | string[];
  attachments?: SendEmailAttachment[];
  tags?: Array<{ name: string; value: string }>;
};

export type SendEmailResult = {
  id: string;
};

function required(_name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ExternalServiceError("Email service is not configured.");
  }
  return trimmed;
}

export function getResendApiKey() {
  return required("RESEND_API_KEY", process.env.RESEND_API_KEY);
}

/** Verified sender, e.g. `Irecon Insurance <policies@example.com.au>`. */
export function getEmailFrom() {
  return required(
    "EMAIL_FROM",
    process.env.EMAIL_FROM ?? process.env.RESEND_FROM_ADDRESS,
  );
}

export function getEmailReplyTo() {
  return process.env.EMAIL_REPLY_TO?.trim() || undefined;
}

export function createResendClient(apiKey = getResendApiKey()) {
  return new Resend(apiKey);
}

function extensionForMime(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "bin";
}

/**
 * Email clients do not render `data:` image URIs — they often show the base64
 * as plain text. Convert them to Resend CID inline attachments.
 */
export function convertDataUriImagesToCid(html: string): {
  html: string;
  attachments: SendEmailAttachment[];
} {
  const attachments: SendEmailAttachment[] = [];
  let index = 0;

  const nextHtml = html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*["'])(data:([^;"']+);base64,([A-Za-z0-9+/=\s]+))(["'][^>]*>)/gi,
    (
      _match,
      prefix: string,
      _dataUri: string,
      contentType: string,
      base64: string,
      suffix: string,
    ) => {
      const contentId = `irecon-inline-${index++}`;
      const mime = contentType.trim().toLowerCase();
      const cleanBase64 = base64.replace(/\s+/g, "");
      attachments.push({
        filename: `${contentId}.${extensionForMime(mime)}`,
        content: cleanBase64,
        contentType: mime,
        contentId,
      });
      return `${prefix}cid:${contentId}${suffix}`;
    },
  );

  return { html: nextHtml, attachments };
}

/** Strip leftover data-URI blobs from plain-text bodies. */
export function stripDataUrisFromText(text: string): string {
  return text
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi, "[image]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Thin Resend wrapper. Call only from server actions / resource routes.
 * Never expose RESEND_API_KEY to the browser.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const resend = createResendClient();
  const replyTo = input.replyTo ?? getEmailReplyTo();

  const inline = input.html?.trim()
    ? convertDataUriImagesToCid(input.html)
    : { html: undefined as string | undefined, attachments: [] };

  const attachments = [...(input.attachments ?? []), ...inline.attachments];

  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to: input.to,
    subject: input.subject,
    text: stripDataUrisFromText(input.text),
    html: inline.html,
    cc: input.cc,
    replyTo,
    attachments: attachments.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
      contentId: file.contentId,
    })),
    tags: input.tags,
  });

  if (error) {
    throw new ExternalServiceError("Email could not be sent right now.");
  }
  if (!data?.id) {
    throw new ExternalServiceError("Email could not be sent right now.");
  }
  return { id: data.id };
}
