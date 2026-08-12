import { z } from "zod";

export const accountManagerSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  abbrev: z.string().trim().min(1, "Abbreviation is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Email is not in the correct format"),
  arNumber: z.string().trim().min(1, "AR number is required"),
  mobile: z.string().trim(),
});

export type AccountManagerFormValues = z.infer<typeof accountManagerSchema>;
