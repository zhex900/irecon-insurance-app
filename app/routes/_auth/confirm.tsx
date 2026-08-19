import { Link, redirect } from "react-router";

import { AuthHashSessionBridge } from "~/components/auth/auth-hash-session-bridge";
import { AuthShell } from "~/components/auth/auth-shell";
import { buttonVariants } from "~/components/ui/button";
import {
  appendAuthSessionCookies,
  exchangeCodeForSession,
  setSessionFromTokens,
} from "~/lib/supabase/auth.server";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/confirm";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/reset-password";
  }
  return value;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    // No PKCE code — may still have recovery tokens in the URL hash (client-only).
    return { next };
  }

  const { data, error } = await exchangeCodeForSession(code);
  if (error || !data.session) {
    return redirect(
      `/forgot-password?error=${encodeURIComponent(
        error?.message ?? "Invalid or expired reset link.",
      )}`,
    );
  }

  const headers = new Headers();
  appendAuthSessionCookies(headers, data.session, request);
  headers.set("Location", next);
  return new Response(null, { status: 302, headers });
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const accessToken = String(formData.get("access_token") ?? "");
  const refreshToken = String(formData.get("refresh_token") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!accessToken || !refreshToken) {
    return redirect(
      `/forgot-password?error=${encodeURIComponent("Invalid reset link.")}`,
    );
  }

  const { data, error } = await setSessionFromTokens({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session) {
    return redirect(
      `/forgot-password?error=${encodeURIComponent(
        error?.message ?? "Invalid or expired reset link.",
      )}`,
    );
  }

  const headers = new Headers();
  appendAuthSessionCookies(headers, data.session, request);
  headers.set("Location", next);
  return new Response(null, { status: 302, headers });
}

export default function AuthConfirmRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AuthShell>
      <AuthHashSessionBridge next={loaderData.next} />
      <h2 className="text-2xl font-semibold">Confirming…</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Finishing your password reset link. If nothing happens, request a new
        link.
      </p>
      <div className="mt-8">
        <Link
          to="/forgot-password"
          className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
        >
          Request reset link
        </Link>
      </div>
    </AuthShell>
  );
}
