import { Outlet, redirect } from "react-router";
import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import type { Route } from "./+types/prices";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Prices") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const pricesEnabled = await isFeatureEnabled("prices");
  if (!pricesEnabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }
  return null;
}

export default function SettingsPricesLayout() {
  return <Outlet />;
}
