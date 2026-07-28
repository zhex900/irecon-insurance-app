import {
  appendAuthSessionCookies,
  appendClearAuthSessionCookies,
  getAuthUserWithSession,
} from "~/lib/supabase/auth.server";
import { getUser } from "~/lib/services/users/service";
import type { AppUser } from "~/lib/db/types";

export async function getSessionAppUser(
  request: Request,
): Promise<{ user: AppUser | null; setCookieHeaders?: Headers }> {
  const { user: authUser, session } = await getAuthUserWithSession(request);
  if (!authUser) return { user: null };

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
    // Refreshed session — refresh cookies for the caller when needed.
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
    );
  }

  return {
    user: profile,
    setCookieHeaders: headers.has("Set-Cookie") ? headers : undefined,
  };
}

export async function requireAuth(request: Request): Promise<AppUser> {
  const { user } = await getSessionAppUser(request);
  if (!user) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/login" },
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
