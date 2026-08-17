import { Form, Link, useNavigation, useSearchParams } from "react-router";

import { AuthShell } from "~/components/auth/auth-shell";
import { buttonVariants } from "~/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { LoadingButton } from "~/components/ui/loading-button";
import { pageTitle } from "~/lib/brand";
import { logger } from "~/lib/observability/logger.server";
import { resetPasswordForEmail } from "~/lib/supabase/auth.server";
import { getAppOrigin } from "~/lib/supabase/env.server";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/forgot-password";

export function meta() {
  return [{ title: pageTitle("Forgot password") }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required" };
  }

  const origin = getAppOrigin(request);
  const redirectTo = `${origin}/auth/confirm?next=/reset-password`;
  const { error } = await resetPasswordForEmail(email, redirectTo);

  if (error) {
    const msg = error.message.toLowerCase();
    logger.warn("Password reset email failed", {
      operation: "auth_password_reset_email",
      errorType: error.name,
    });
    if (
      msg.includes("rate limit") ||
      msg.includes("over_email_send_rate_limit") ||
      (error as { code?: string }).code === "over_email_send_rate_limit"
    ) {
      return {
        error:
          "Too many password reset emails were sent recently. Wait about an hour and try again, or ask an admin to reset your password.",
      };
    }
    // Other delivery failures — don't claim success.
    return {
      error:
        "We couldn't send a reset email right now. Try again shortly, or contact an admin.",
    };
  }

  return {
    success:
      "If an account exists for that email, we sent a password reset link. Check your inbox (and spam).",
  };
}

export default function ForgotPasswordRoute({
  actionData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const success =
    actionData && "success" in actionData ? actionData.success : null;
  const error =
    (actionData && "error" in actionData ? actionData.error : null) ??
    searchParams.get("error");

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold">Forgot password</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email and we&apos;ll send a reset link.
      </p>

      {success ? (
        <div className="mt-8 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{success}</p>
          <Link
            to="/login"
            className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <Form method="post" className="mt-8">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="Email address"
                className="h-10"
                required
              />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
            <LoadingButton
              type="submit"
              size="lg"
              className="mt-2 w-full"
              loading={submitting}
            >
              Send reset link
            </LoadingButton>
            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="hover:text-foreground hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </FieldGroup>
        </Form>
      )}
    </AuthShell>
  );
}
