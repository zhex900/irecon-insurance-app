import { z } from "zod";
import type { Client } from "~/lib/db/types";

const optionalText = z.string().default("");

/** Soft schema for blur / draft saves (incomplete clients allowed). */
export const clientDraftSchema = z.object({
  name: z.string().default(""),
  tradingName: z.string().default(""),
  abn: z
    .string()
    .trim()
    .default("")
    .refine(
      (value) => value === "" || /^\d{11}$/.test(value.replace(/\s/g, "")),
      "ABN must be 11 digits",
    )
    .transform((value) => value.replace(/\s/g, "")),
  phone: optionalText,
  email: z
    .string()
    .trim()
    .default("")
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Email is not in the correct format",
    ),
  accountManagerId: z.coerce.number().default(0),
  clientSourceId: z.coerce.number().default(16),
  authorisedRepresentativeId: z.coerce.number().default(0),
});

/** Full validation when finishing / explicit create completeness checks. */
export const clientSchema = clientDraftSchema.superRefine((values, ctx) => {
  if (!values.name.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["name"],
      message: "Registered name is required",
    });
  }
  if (!values.tradingName.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["tradingName"],
      message: "Trading name is required",
    });
  }
  if (values.accountManagerId < 1) {
    ctx.addIssue({
      code: "custom",
      path: ["accountManagerId"],
      message: "Account manager is required",
    });
  }
  if (values.authorisedRepresentativeId < 1) {
    ctx.addIssue({
      code: "custom",
      path: ["authorisedRepresentativeId"],
      message: "Authorised Representative is required",
    });
  }
});

export type ClientFormValues = z.infer<typeof clientDraftSchema>;

export function clientToFormValues(client: Client): ClientFormValues {
  return {
    name: client.name,
    tradingName: client.tradingName,
    abn: client.abn ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    accountManagerId: client.accountManagerId,
    clientSourceId: client.clientSourceId ?? 16,
    authorisedRepresentativeId: client.authorisedRepresentativeId,
  };
}

export function formValuesToClientInput(values: ClientFormValues) {
  return {
    name: values.name.trim() || "",
    tradingName: values.tradingName.trim(),
    abn: values.abn,
    phone: values.phone?.trim() ?? "",
    email: values.email.trim(),
    accountManagerId: values.accountManagerId,
    clientSourceId: values.clientSourceId || 16,
    authorisedRepresentativeId: values.authorisedRepresentativeId,
  };
}
