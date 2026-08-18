import { getSupabaseAdmin } from "~/lib/supabase/admin.server";

export type PasswordRecoveryLinkResult =
  | { ok: true; actionLink: string }
  | { ok: false; reason: "not_found" | "generate_failed"; message: string };

/**
 * Mint a Supabase recovery link without sending Supabase Auth email.
 * Caller sends the link via Resend (custom template + EMAIL_FROM).
 */
export async function generatePasswordRecoveryLink(
  email: string,
  redirectTo: string,
): Promise<PasswordRecoveryLinkResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
    options: { redirectTo },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("not found") ||
      message.includes("user not found") ||
      (error as { code?: string }).code === "user_not_found"
    ) {
      return { ok: false, reason: "not_found", message: error.message };
    }
    return {
      ok: false,
      reason: "generate_failed",
      message: error.message,
    };
  }

  const actionLink = data.properties?.action_link?.trim();
  if (!actionLink) {
    return {
      ok: false,
      reason: "generate_failed",
      message: "Recovery link was not generated.",
    };
  }

  return { ok: true, actionLink };
}
