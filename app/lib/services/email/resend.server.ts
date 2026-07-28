import { Resend } from "resend";

export type SendEmailAttachment = {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
  contentType?: string;
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

function required(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `${name} is not set. Add it to .env (local) or Worker secrets (staging/prod).`,
    );
  }
  return trimmed;
}

export function getResendApiKey() {
  return required("RESEND_API_KEY", process.env.RESEND_API_KEY);
}

/** Verified sender, e.g. `BrokerSure <policies@example.com.au>`. */
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

/**
 * Thin Resend wrapper. Call only from server actions / resource routes.
 * Never expose RESEND_API_KEY to the browser.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const resend = createResendClient();
  const replyTo = input.replyTo ?? getEmailReplyTo();

  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    cc: input.cc,
    replyTo,
    attachments: input.attachments?.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
    })),
    tags: input.tags,
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send email");
  }
  if (!data?.id) {
    throw new Error("Resend did not return an email id");
  }
  return { id: data.id };
}
