import {
  destroySessionCookieHeaders,
  getSessionAppUser,
} from "~/lib/auth/session.server";
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
  }
  const headers = destroySessionCookieHeaders(new Headers(), request);
  headers.set("Location", "/login");
  return new Response(null, { status: 302, headers });
}

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

export async function loader({ request }: Route.LoaderArgs) {
  return logout(request);
}
