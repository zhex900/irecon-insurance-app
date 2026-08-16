import {
  destroySessionCookieHeaders,
  getSessionAppUser,
} from "~/lib/auth/session/server.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import type { Route } from "./+types/logout";

async function logout(request: Request) {
  const { user } = await getSessionAppUser(request);
  if (user) {
    await writeAuditLog({
      actor: user,
      action: "auth.logout",
      summary: `Signed out ${user.email}`,
      request,
    });

    // Enhanced security logging for logout
    const { logAuthEvent } =
      await import("~/lib/security/basic-logging.server");
    await logAuthEvent("logout", user, {}, request);
  }
  const headers = destroySessionCookieHeaders(new Headers(), request);
  const reason = new URL(request.url).searchParams.get("reason");
  const location =
    reason === "idle" || reason === "expired"
      ? `/login?reason=${reason}`
      : "/login";
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

export async function loader({ request }: Route.LoaderArgs) {
  return logout(request);
}
