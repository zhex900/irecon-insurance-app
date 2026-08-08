import * as React from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import { TurnstileWidget } from "~/components/auth/turnstile-widget";
import { AuthShell } from "~/components/auth/auth-shell";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  appendAuthSessionCookies,
  signInWithPassword,
} from "~/lib/supabase/auth.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { getUser } from "~/lib/services/users/service";
import type { Route } from "./+types/login";
import { pageTitle } from "~/lib/brand";
import {
  isTurnstileEnabled,
  readTurnstileSecretKey,
  readTurnstileSiteKey,
} from "~/lib/turnstile/config";
import {
  clientIpFromRequest,
  verifyTurnstileToken,
} from "~/lib/turnstile/verify.server";

export function meta() {
  return [{ title: pageTitle("Sign in") }];
}

export async function loader() {
  const siteKey = readTurnstileSiteKey();
  return {
    turnstileSiteKey: isTurnstileEnabled() && siteKey ? siteKey : null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email) {
      return { error: "Email is required" };
    }
    if (!password) {
      return { error: "Password is required" };
    }

    if (isTurnstileEnabled()) {
      const turnstileToken = String(
        formData.get("cf-turnstile-response") ?? "",
      ).trim();
      if (!turnstileToken) {
        return { error: "Complete the security check before signing in." };
      }

      const secretKey = readTurnstileSecretKey();
      if (!secretKey) {
        return { error: "Sign in is temporarily unavailable. Try again shortly." };
      }

      const turnstile = await verifyTurnstileToken(
        turnstileToken,
        secretKey,
        clientIpFromRequest(request),
      );
      if (!turnstile.success) {
        return { error: "Security check failed. Refresh and try again." };
      }
    }

    const { data, error } = await signInWithPassword(email, password);
    if (error || !data.session || !data.user) {
      return { error: "Invalid email or password" };
    }

    const profile = await getUser(data.user.id);
    if (!profile) {
      return { error: "No app profile for this account. Contact an admin." };
    }
    if (profile.disabled) {
      return { error: "This account is disabled. Contact an admin." };
    }

    await writeAuditLog({
      actor: profile,
      action: "auth.login",
      summary: `Signed in as ${profile.email}`,
      request,
    });

    const headers = new Headers();
    appendAuthSessionCookies(headers, data.session, request);
    headers.set("Location", "/dashboard");
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return {
      error: publicErrorMessage(error, {
        fallback: "Sign in failed. Try again shortly.",
        operation: "auth_login",
      }),
    };
  }
}

export default function LoginRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const resetOk = searchParams.get("reset") === "1";
  const turnstileSiteKey = loaderData?.turnstileSiteKey ?? null;
  const [turnstileReady, setTurnstileReady] = React.useState(!turnstileSiteKey);
  const [turnstileEpoch, setTurnstileEpoch] = React.useState(0);
  const loginError =
    actionData && "error" in actionData && actionData.error
      ? actionData.error
      : null;

  React.useEffect(() => {
    if (!loginError || !turnstileSiteKey) return;
    setTurnstileReady(false);
    setTurnstileEpoch((epoch) => epoch + 1);
  }, [loginError, turnstileSiteKey]);

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold">Welcome back</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign in to your broker account.
      </p>

      {resetOk ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Password updated. Sign in with your new password.
        </p>
      ) : null}

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
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              className="h-10"
            />
          </Field>
          {loginError ? <FieldError>{loginError}</FieldError> : null}
          {turnstileSiteKey ? (
            <TurnstileWidget
              key={turnstileEpoch}
              siteKey={turnstileSiteKey}
              onTokenChange={(token) => setTurnstileReady(Boolean(token))}
            />
          ) : null}
          <LoadingButton
            type="submit"
            size="lg"
            className="mt-2 w-full"
            loading={submitting}
            disabled={!turnstileReady}
          >
            Sign in
          </LoadingButton>
        </FieldGroup>
      </Form>
    </AuthShell>
  );
}
