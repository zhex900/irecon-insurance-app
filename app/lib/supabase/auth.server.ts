import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "~/lib/supabase/env.server";

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";

function createAnonClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
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

export function createAuthSessionHeaders(session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}, request?: Request) {
  const maxAge = session.expires_in ?? 60 * 60;
  const secure = cookieSecureFromRequest(request);
  return {
    "Set-Cookie": [
      cookie(ACCESS_COOKIE, session.access_token, { maxAge, secure }),
      cookie(REFRESH_COOKIE, session.refresh_token, {
        maxAge: 60 * 60 * 24 * 30,
        secure,
      }),
    ].join(", "),
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
) {
  const maxAge = session.expires_in ?? 60 * 60;
  const secure = cookieSecureFromRequest(request);
  headers.append(
    "Set-Cookie",
    cookie(ACCESS_COOKIE, session.access_token, { maxAge, secure }),
  );
  headers.append(
    "Set-Cookie",
    cookie(REFRESH_COOKIE, session.refresh_token, {
      maxAge: 60 * 60 * 24 * 30,
      secure,
    }),
  );
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
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = createAnonClient();
  return supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

export async function resetPasswordForEmail(email: string, redirectTo: string) {
  const supabase = createAnonClient();
  return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
}

export async function exchangeCodeForSession(code: string) {
  const supabase = createAnonClient();
  return supabase.auth.exchangeCodeForSession(code);
}

export async function setSessionFromTokens(session: {
  access_token: string;
  refresh_token: string;
}) {
  const supabase = createAnonClient();
  return supabase.auth.setSession(session);
}

export async function updatePassword(
  accessToken: string,
  refreshToken: string,
  password: string,
) {
  const supabase = createAnonClient();
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

  const supabase = createAnonClient();
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

  const supabase = createAnonClient();
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
