import { z } from "zod";

export const authorisedRepresentativeSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  companyName: z.string().trim().min(1, "Company name is required"),
  arNumber: z.string().trim().min(1, "AR number is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Email is not in the correct format"),
});

export type AuthorisedRepresentativeFormValues = z.infer<
  typeof authorisedRepresentativeSchema
>;
