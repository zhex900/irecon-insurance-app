/** Contact source for policy email To/Cc autocomplete. */
export type EmailDirectoryKind = "user" | "ar" | "client";

export type EmailDirectoryEntry = {
  email: string;
  name: string;
  kind: EmailDirectoryKind;
};

export const EMAIL_DIRECTORY_KIND_LABEL: Record<EmailDirectoryKind, string> = {
  user: "User",
  ar: "AR",
  client: "Client",
};
