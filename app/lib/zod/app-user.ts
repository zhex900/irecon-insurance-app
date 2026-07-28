import { z } from "zod";

export const appUserSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Email is not in the correct format"),
    role: z.enum(["broker", "admin"]),
    disabled: z.boolean(),
    /** Required when creating; leave blank on edit to keep current. */
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const password = values.password ?? "";
    const confirm = values.confirmPassword ?? "";

    if (password !== "") {
      if (password.length < 8) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password must be at least 8 characters",
        });
      }
      if (confirm === "") {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "Confirm your password",
        });
      } else if (password !== confirm) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "Passwords do not match",
        });
      }
    } else if (confirm !== "") {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Enter a new password",
      });
    }
  });

export const appUserCreateSchema = appUserSchema.superRefine((values, ctx) => {
  if (!values.password || values.password.length < 8) {
    ctx.addIssue({
      code: "custom",
      path: ["password"],
      message: "Password is required (min 8 characters)",
    });
  }
});

/** Parse FormData / loose action payloads into AppUserFormValues. */
export function parseAppUserFormData(
  input: {
    fullName: FormDataEntryValue | null;
    email: FormDataEntryValue | null;
    role: FormDataEntryValue | null;
    disabled: FormDataEntryValue | null;
    password?: FormDataEntryValue | null;
    confirmPassword?: FormDataEntryValue | null;
  },
  mode: "create" | "update",
) {
  const password = String(input.password ?? "");
  const confirmPassword = String(input.confirmPassword ?? "");

  const payload = {
    fullName: String(input.fullName ?? ""),
    email: String(input.email ?? ""),
    role: String(input.role ?? ""),
    disabled:
      input.disabled === "true" ||
      input.disabled === "on" ||
      input.disabled === "1",
    password: password || undefined,
    confirmPassword: confirmPassword || undefined,
  };

  return (mode === "create" ? appUserCreateSchema : appUserSchema).safeParse(
    payload,
  );
}

export type AppUserFormValues = z.infer<typeof appUserSchema>;
