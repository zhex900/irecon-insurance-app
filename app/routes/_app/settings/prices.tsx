import { Outlet } from "react-router";

import { requireFeatureOrSuperAdminPage } from "~/lib/auth/authorize.server";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import { isFeatureEnabled } from "~/lib/services/feature-flags";

import type { Route } from "./+types/prices";

export function meta() {
  return [{ title: pageTitle("Prices") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const pricesEnabled = await isFeatureEnabled("prices");
  requireFeatureOrSuperAdminPage(pricesEnabled, viewer);
  return null;
}

export default function SettingsPricesLayout() {
  return <Outlet />;
}
