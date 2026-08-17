import { redirect } from "react-router";

import { getSessionAppUser } from "~/lib/auth/session/server.server";

import type { Route } from "./+types/_index";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSessionAppUser(request);
  if (!user) {
    return redirect("/login");
  }

  return redirect("/dashboard");
}
