import { z } from "zod";

import {
  isWordingHtmlEmpty,
  normalizeWordingHtmlForSave,
  normalizeWordingSubjectForSave,
} from "~/lib/policies/wording/html";

export const carWordingFormSchema = z.object({
  subject: z
    .string()
    .max(500)
    .transform((v) => normalizeWordingSubjectForSave(v))
    .refine((v) => !isWordingHtmlEmpty(v), "Subject is required"),
  content: z
    .string()
    .max(50_000)
    .transform((v) => normalizeWordingHtmlForSave(v))
    .refine((v) => !isWordingHtmlEmpty(v), "Content is required"),
});

export type CarWordingFormValues = z.infer<typeof carWordingFormSchema>;
export type CarWordingFormInput = z.input<typeof carWordingFormSchema>;
