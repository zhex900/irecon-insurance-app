import { createClient } from "@supabase/supabase-js";

import type { SessionTiming } from "~/lib/auth/session";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "~/lib/supabase/env.server";

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";
const SESSION_STARTED_COOKIE = "sb-session-started";
const LAST_ACTIVITY_COOKIE = "sb-last-activity";

/** Refresh cookie lifetime (browser). Absolute/inactivity still enforced server-side. */
const REFRESH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function createPublishableClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function parseCookies(request: Request) {
  const header = request.headers.get("Cookie") ?? "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

function cookie(
  name: string,
  value: string,
  options: { maxAge?: number; secure?: boolean } = {},
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.secure) parts.push("Secure");
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function cookieSecureFromRequest(request?: Request) {
  if (!request) {
    return (process.env.APP_URL ?? "").startsWith("https://");
  }
  return new URL(request.url).protocol === "https:";
}

function parseUnixMs(raw: string | undefined): number | null {
  if (!raw) return null;
  const sec = Number(raw);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return Math.floor(sec * 1000);
}

export function readSessionTiming(request: Request): SessionTiming {
  const cookies = parseCookies(request);
  return {
    startedAtMs: parseUnixMs(cookies[SESSION_STARTED_COOKIE]),
    lastActivityAtMs: parseUnixMs(cookies[LAST_ACTIVITY_COOKIE]),
  };
}

function appendSessionTimingCookies(
  headers: Headers,
  request: Request | undefined,
  nowMs: number,
  options?: { startedAtMs?: number },
) {
  const secure = cookieSecureFromRequest(request);
  const startedSec = Math.floor((options?.startedAtMs ?? nowMs) / 1000);
  const activitySec = Math.floor(nowMs / 1000);
  headers.append(
    "Set-Cookie",
    cookie(SESSION_STARTED_COOKIE, String(startedSec), {
      maxAge: REFRESH_COOKIE_MAX_AGE_SEC,
      secure,
    }),
  );
  headers.append(
    "Set-Cookie",
    cookie(LAST_ACTIVITY_COOKIE, String(activitySec), {
      maxAge: REFRESH_COOKIE_MAX_AGE_SEC,
      secure,
    }),
  );
}

export function appendLastActivityCookie(
  headers: Headers,
  request: Request | undefined,
  nowMs: number,
  startedAtMs: number,
) {
  appendSessionTimingCookies(headers, request, nowMs, { startedAtMs });
}

export function createAuthSessionHeaders(
  session: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  },
  request?: Request,
) {
  const headers = new Headers();
  appendAuthSessionCookies(headers, session, request);
  return {
    "Set-Cookie": headers.getSetCookie().join(", "),
  };
}

/** Multiple Set-Cookie values (Response headers API). */
export function appendAuthSessionCookies(
  headers: Headers,
  session: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  },
  request?: Request,
  options?: {
    nowMs?: number;
    /** When true (default), reset absolute + inactivity clocks (login). */
    resetTiming?: boolean;
    startedAtMs?: number;
  },
) {
  const maxAge = session.expires_in ?? 60 * 60;
  const secure = cookieSecureFromRequest(request);
  const nowMs = options?.nowMs ?? Date.now();
  headers.append(
    "Set-Cookie",
    cookie(ACCESS_COOKIE, session.access_token, { maxAge, secure }),
  );
  headers.append(
    "Set-Cookie",
    cookie(REFRESH_COOKIE, session.refresh_token, {
      maxAge: REFRESH_COOKIE_MAX_AGE_SEC,
      secure,
    }),
  );
  if (options?.resetTiming !== false) {
    appendSessionTimingCookies(headers, request, nowMs, {
      startedAtMs: options?.startedAtMs,
    });
  }
}

export function appendClearAuthSessionCookies(
  headers: Headers,
  request?: Request,
) {
  const secure = cookieSecureFromRequest(request);
  headers.append(
    "Set-Cookie",
    cookie(ACCESS_COOKIE, "", { maxAge: 0, secure }),
  );
  headers.append(
    "Set-Cookie",
    cookie(REFRESH_COOKIE, "", { maxAge: 0, secure }),
  );
  headers.append(
    "Set-Cookie",
    cookie(SESSION_STARTED_COOKIE, "", { maxAge: 0, secure }),
  );
  headers.append(
    "Set-Cookie",
    cookie(LAST_ACTIVITY_COOKIE, "", { maxAge: 0, secure }),
  );
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = createPublishableClient();
  return supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

/** @deprecated Prefer generatePasswordRecoveryLink + Resend (forgot-password). */
export async function resetPasswordForEmail(email: string, redirectTo: string) {
  const supabase = createPublishableClient();
  return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
}

export async function exchangeCodeForSession(code: string) {
  const supabase = createPublishableClient();
  return supabase.auth.exchangeCodeForSession(code);
}

export async function setSessionFromTokens(session: {
  access_token: string;
  refresh_token: string;
}) {
  const supabase = createPublishableClient();
  return supabase.auth.setSession(session);
}

export async function updatePassword(
  accessToken: string,
  refreshToken: string,
  password: string,
) {
  const supabase = createPublishableClient();
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) {
    return { data: { user: null }, error: sessionError };
  }
  return supabase.auth.updateUser({ password });
}

export async function getAuthUser(request: Request) {
  const cookies = parseCookies(request);
  const access = cookies[ACCESS_COOKIE];
  if (!access) return null;

  const supabase = createPublishableClient();
  const { data, error } = await supabase.auth.getUser(access);
  if (!error && data.user) return data.user;

  const refresh = cookies[REFRESH_COOKIE];
  if (!refresh) return null;

  const refreshed = await supabase.auth.refreshSession({
    refresh_token: refresh,
  });
  if (refreshed.error || !refreshed.data.session?.user) return null;
  return refreshed.data.session.user;
}

export async function getAuthUserWithSession(request: Request) {
  const cookies = parseCookies(request);
  const access = cookies[ACCESS_COOKIE];
  const refresh = cookies[REFRESH_COOKIE];
  if (!access && !refresh) return { user: null, session: null };

  const supabase = createPublishableClient();
  if (access) {
    const { data, error } = await supabase.auth.getUser(access);
    if (!error && data.user) {
      return {
        user: data.user,
        session: {
          access_token: access,
          refresh_token: refresh ?? "",
        },
      };
    }
  }

  if (!refresh) return { user: null, session: null };
  const refreshed = await supabase.auth.refreshSession({
    refresh_token: refresh,
  });
  if (refreshed.error || !refreshed.data.session?.user) {
    return { user: null, session: null };
  }
  return {
    user: refreshed.data.session.user,
    session: refreshed.data.session,
  };
}
