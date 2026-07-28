export const EMAIL_RECIPIENT_TYPES = ["broker", "insurer"] as const;
export type EmailRecipientType = (typeof EMAIL_RECIPIENT_TYPES)[number];

export type EmailTemplate = {
  recipientType: EmailRecipientType;
  subject: string;
  body: string;
  /** Insurer only. Broker recipients use the client's AR email. */
  toEmail: string;
};

export type EmailTemplateVars = {
  clientName?: string;
  policyNumber?: string;
  brokerName?: string;
};

export const DEFAULT_EMAIL_TEMPLATES: Record<
  EmailRecipientType,
  Omit<EmailTemplate, "recipientType">
> = {
  broker: {
    subject: "CAR policy documents — {{policyNumber}}",
    body: [
      "Dear {{brokerName}},",
      "",
      "Please find attached the documents for policy {{policyNumber}} for {{clientName}}.",
      "",
      "If you have any questions, please reply to this email.",
      "",
      "Kind regards",
    ].join("\n"),
    toEmail: "",
  },
  insurer: {
    subject: "CAR policy — {{policyNumber}} — {{clientName}}",
    body: [
      "Dear Underwriter,",
      "",
      "Please find attached the documents for policy {{policyNumber}} for insured {{clientName}}.",
      "",
      "Kind regards",
    ].join("\n"),
    toEmail: "",
  },
};

export function applyEmailTemplate(
  template: string,
  vars: EmailTemplateVars,
): string {
  return template
    .replaceAll("{{clientName}}", vars.clientName?.trim() || "Client")
    .replaceAll("{{policyNumber}}", vars.policyNumber?.trim() || "")
    .replaceAll("{{brokerName}}", vars.brokerName?.trim() || "Broker");
}
