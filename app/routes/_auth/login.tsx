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

function LoginTurnstileGate({
  siteKey,
  submitting,
}: {
  siteKey: string;
  submitting: boolean;
}) {
  const [ready, setReady] = React.useState(false);

  return (
    <>
      <TurnstileWidget
        siteKey={siteKey}
        onTokenChange={(token) => setReady(Boolean(token))}
      />
      <LoadingButton
        type="submit"
        size="lg"
        className="mt-2 w-full"
        loading={submitting}
        disabled={!ready}
      >
        Sign in
      </LoadingButton>
    </>
  );
}

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
      const { trackUsage } = await import("~/lib/observability/metrics.server");
      trackUsage("auth.login", { result: "failure", reason: "missing_email" });
      return { error: "Email is required" };
    }
    if (!password) {
      const { trackUsage } = await import("~/lib/observability/metrics.server");
      trackUsage("auth.login", {
        result: "failure",
        reason: "missing_password",
      });
      return { error: "Password is required" };
    }

    if (isTurnstileEnabled()) {
      const turnstileToken = String(
        formData.get("cf-turnstile-response") ?? "",
      ).trim();
      if (!turnstileToken) {
        const { trackUsage } = await import("~/lib/observability/metrics.server");
        trackUsage("auth.login", {
          result: "failure",
          reason: "turnstile_missing",
        });
        return { error: "Complete the security check before signing in." };
      }

      const secretKey = readTurnstileSecretKey();
      if (!secretKey) {
        const { trackUsage } = await import("~/lib/observability/metrics.server");
        trackUsage("auth.login", {
          result: "failure",
          reason: "turnstile_unavailable",
        });
        return {
          error: "Sign in is temporarily unavailable. Try again shortly.",
        };
      }

      const turnstile = await verifyTurnstileToken(
        turnstileToken,
        secretKey,
        clientIpFromRequest(request),
      );
      if (!turnstile.success) {
        const { trackUsage } = await import("~/lib/observability/metrics.server");
        trackUsage("auth.login", {
          result: "failure",
          reason: "turnstile_failed",
        });
        return { error: "Security check failed. Refresh and try again." };
      }
    }

    const { data, error } = await signInWithPassword(email, password);
    if (error || !data.session || !data.user) {
      const { trackUsage } = await import("~/lib/observability/metrics.server");
      trackUsage("auth.login", {
        result: "failure",
        reason: "invalid_credentials",
      });
      
      // Enhanced security logging for failed login
      const { logAuthEvent } = await import("~/lib/security/basic-logging.server");
      await logAuthEvent("failure", null, {
        emailAttempted: email,
        reason: "invalid_credentials",
      }, request);
      
      return { error: "Invalid email or password" };
    }

    const profile = await getUser(data.user.id);
    if (!profile) {
      const { trackUsage } = await import("~/lib/observability/metrics.server");
      trackUsage("auth.login", { result: "failure", reason: "no_profile" });
      return { error: "No app profile for this account. Contact an admin." };
    }
    if (profile.disabled) {
      const { trackUsage } = await import("~/lib/observability/metrics.server");
      trackUsage("auth.login", { result: "failure", reason: "disabled" });
      return { error: "This account is disabled. Contact an admin." };
    }

    await writeAuditLog({
      actor: profile,
      action: "auth.login",
      summary: `Signed in as ${profile.email}`,
      request,
    });

    // Enhanced security logging for successful login
    const { logAuthEvent } = await import("~/lib/security/basic-logging.server");
    await logAuthEvent("success", profile, {
      role: profile.role,
    }, request);

    const { trackUsage } = await import("~/lib/observability/metrics.server");
    trackUsage("auth.login", {
      result: "success",
      role: profile.role,
    });

    const headers = new Headers();
    appendAuthSessionCookies(headers, data.session, request);
    headers.set("Location", "/dashboard");
    return new Response(null, { status: 302, headers });
  } catch (error) {
    const { trackUsage } = await import("~/lib/observability/metrics.server");
    trackUsage("auth.login", { result: "failure", reason: "exception" });
    const { publicErrorMessage } = await import("~/lib/http/public-error.server");
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
  const sessionReason = searchParams.get("reason");
  const turnstileSiteKey = loaderData?.turnstileSiteKey ?? null;
  const loginError =
    actionData && "error" in actionData && actionData.error
      ? actionData.error
      : null;
  const turnstileResetKey = loginError ?? "sign-in";
  const sessionMessage =
    sessionReason === "idle"
      ? "You were signed out after a period of inactivity."
      : sessionReason === "expired"
        ? "Your session expired. Sign in again to continue."
        : null;

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

      {sessionMessage ? (
        <p className="mt-4 text-sm text-muted-foreground">{sessionMessage}</p>
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
            <LoginTurnstileGate
              key={turnstileResetKey}
              siteKey={turnstileSiteKey}
              submitting={submitting}
            />
          ) : (
            <LoadingButton
              type="submit"
              size="lg"
              className="mt-2 w-full"
              loading={submitting}
            >
              Sign in
            </LoadingButton>
          )}
        </FieldGroup>
      </Form>
    </AuthShell>
  );
}
