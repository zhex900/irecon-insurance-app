import { redirect } from "react-router";

import { requireAuth } from "~/lib/auth/session/server.server";

import type { Route } from "./+types/_index";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  throw redirect("/settings/prices/car-rates");
}
