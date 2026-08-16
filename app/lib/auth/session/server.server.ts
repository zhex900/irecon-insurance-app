import {
  appendAuthSessionCookies,
  appendClearAuthSessionCookies,
  appendLastActivityCookie,
  getAuthUserWithSession,
  readSessionTiming,
} from "~/lib/supabase/auth.server";
import { evaluateSessionTimeout, readSessionTimeoutConfig } from "./timeout.server";
import { trackUsage } from "~/lib/observability/metrics.server";
import { queueSetCookie } from "~/lib/observability/request-context.server";
import { getUser } from "~/lib/services/users/service";
import type { AppUser } from "~/lib/db/types";

export type SessionEndReason = "inactivity" | "absolute";

export async function getSessionAppUser(request: Request): Promise<{
  user: AppUser | null;
  setCookieHeaders?: Headers;
  sessionEndReason?: SessionEndReason;
}> {
  const { user: authUser, session } = await getAuthUserWithSession(request);
  if (!authUser) return { user: null };

  const timing = readSessionTiming(request);
  const timeout = evaluateSessionTimeout(timing, readSessionTimeoutConfig());
  if (!timeout.ok) {
    trackUsage("auth.session_end", { reason: timeout.reason });
    const headers = new Headers();
    appendClearAuthSessionCookies(headers, request);
    return {
      user: null,
      setCookieHeaders: headers,
      sessionEndReason: timeout.reason,
    };
  }

  const profile = await getUser(authUser.id);
  if (!profile || profile.disabled) return { user: null };

  const headers = new Headers();
  if (
    session &&
    "access_token" in session &&
    session.access_token &&
    session.refresh_token &&
    !request.headers.get("Cookie")?.includes(session.access_token)
  ) {
    // Refreshed access token — keep absolute session start.
    const startedAtMs = timing.startedAtMs ?? timeout.nowMs;
    appendAuthSessionCookies(
      headers,
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in:
          "expires_in" in session && typeof session.expires_in === "number"
            ? session.expires_in
            : undefined,
      },
      request,
      { resetTiming: false, nowMs: timeout.nowMs },
    );
    appendLastActivityCookie(headers, request, timeout.nowMs, startedAtMs);
  } else if (timeout.shouldRefreshActivity) {
    const startedAtMs = timing.startedAtMs ?? timeout.nowMs;
    appendLastActivityCookie(headers, request, timeout.nowMs, startedAtMs);
  }

  if (headers.has("Set-Cookie")) {
    for (const value of headers.getSetCookie()) {
      queueSetCookie(value);
    }
  }

  return {
    user: profile,
    setCookieHeaders: headers.has("Set-Cookie") ? headers : undefined,
  };
}

export async function requireAuth(request: Request): Promise<AppUser> {
  const { user, setCookieHeaders, sessionEndReason } =
    await getSessionAppUser(request);
  if (!user) {
    const headers = setCookieHeaders ?? new Headers();
    const location =
      sessionEndReason === "inactivity"
        ? "/login?reason=idle"
        : sessionEndReason === "absolute"
          ? "/login?reason=expired"
          : "/login";
    headers.set("Location", location);
    throw new Response(null, {
      status: 302,
      headers,
    });
  }
  return user;
}

export function destroySessionCookieHeaders(
  headers: Headers = new Headers(),
  request?: Request,
) {
  appendClearAuthSessionCookies(headers, request);
  return headers;
}
