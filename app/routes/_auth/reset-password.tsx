import { Form, Link, useNavigation, useSearchParams } from "react-router";

import { AuthHashSessionBridge } from "~/components/auth/auth-hash-session-bridge";
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
import {
  appendClearAuthSessionCookies,
  getAuthUserWithSession,
  updatePassword,
} from "~/lib/supabase/auth.server";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/reset-password";

export function meta() {
  return [{ title: pageTitle("Reset password") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getAuthUserWithSession(request);
  return {
    authenticated: Boolean(user),
    email: user?.email ?? null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user, session } = await getAuthUserWithSession(request);
  if (!user || !session?.access_token || !session.refresh_token) {
    return {
      error: "Your reset link has expired. Request a new one.",
    };
  }

  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const { error } = await updatePassword(
    session.access_token,
    session.refresh_token,
    password,
  );
  if (error) {
    logger.warn("Password reset update failed", {
      operation: "auth_password_update",
      errorType: error.name,
    });
    return {
      error: "Password could not be updated. Request a new reset link.",
    };
  }

  const headers = new Headers();
  appendClearAuthSessionCookies(headers, request);
  headers.set("Location", "/login?reset=1");
  return new Response(null, { status: 302, headers });
}

export default function ResetPasswordRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const error =
    (actionData && "error" in actionData ? actionData.error : null) ??
    searchParams.get("error");

  if (!loaderData.authenticated) {
    return (
      <AuthShell>
        <AuthHashSessionBridge />
        <h2 className="text-2xl font-semibold">Reset password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open the link from your email to choose a new password. If the link
          expired, request another one.
        </p>
        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}
        <div className="mt-8">
          <Link
            to="/forgot-password"
            className={cn(buttonVariants(), "w-full")}
          >
            Request reset link
          </Link>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold">Choose a new password</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {loaderData.email
          ? `Updating password for ${loaderData.email}`
          : "Enter a new password for your account."}
      </p>

      <Form method="post" className="mt-8">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-10"
              required
              minLength={8}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat new password"
              className="h-10"
              required
              minLength={8}
            />
          </Field>
          {error ? <FieldError>{error}</FieldError> : null}
          <LoadingButton
            type="submit"
            size="lg"
            className="mt-2 w-full"
            loading={submitting}
          >
            Update password
          </LoadingButton>
        </FieldGroup>
      </Form>
    </AuthShell>
  );
}
