/**
 * Per-user route history for the side nav Recents stack.
 */
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { appUserRecentRoute, client, policy, policyCar } from "~/lib/db/schema";
import {
  normalizeRecentPath,
  recentCaptionForPath,
  recentIdForPath,
  RECENT_ROUTES_MAX,
} from "~/lib/services/navigation/recent-routes";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";

export {
  normalizeRecentPath,
  RECENT_ROUTES_MAX,
} from "~/lib/services/navigation/recent-routes";

const STATIC_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clients",
  "/policies": "Policies",
  "/reports": "Reports",
  "/reports/clients": "Client Report",
  "/reports/car-policies": "CAR Policy Report",
  "/reports/car-renewals": "CAR Renewal Report",
  "/settings": "Settings",
  "/settings/users": "User Management",
  "/settings/ar-brokers": "Authorised Representatives",
  "/settings/email-templates": "Email Templates",
  "/settings/library-documents": "Library Documents",
  "/settings/document-templates": "Document Templates",
  "/settings/features": "Features",
  "/settings/audit-log": "Audit Log",
  "/settings/prices": "Prices",
  "/settings/prices/car-rates": "Prices",
  "/profile": "Profile",
};

export async function resolveRecentRouteLabel(path: string): Promise<string> {
  if (STATIC_LABELS[path]) return STATIC_LABELS[path];

  if (path.startsWith("/settings/email-templates/")) {
    return "Email Template";
  }
  if (path.startsWith("/settings/document-templates/")) {
    return "Document Template";
  }
  if (path.startsWith("/settings/prices/")) {
    return "Prices";
  }

  const clientMatch = /^\/clients\/(\d+)(?:\/|$)/.exec(path);
  if (clientMatch) {
    const clientId = Number(clientMatch[1]);
    const db = getDb();
    const [row] = await db
      .select({ name: client.name, tradingName: client.tradingName })
      .from(client)
      .where(eq(client.clientId, clientId))
      .limit(1);
    const name =
      row?.name.replace(/\s+/g, " ").trim() ||
      row?.tradingName.replace(/\s+/g, " ").trim();
    return name || `Client ${clientId}`;
  }

  const policyMatch = /^\/policies\/(\d+)(?:\/|$)/.exec(path);
  if (policyMatch) {
    const policyId = Number(policyMatch[1]);
    const db = getDb();
    const [row] = await db
      .select({
        policyNumber: policy.policyNumber,
        insuredName: policyCar.insuredName,
      })
      .from(policy)
      .leftJoin(policyCar, eq(policy.policyId, policyCar.policyId))
      .where(eq(policy.policyId, policyId))
      .limit(1);
    const number = (row?.policyNumber ?? "").replace(/\s+/g, " ").trim();
    const insured = (row?.insuredName ?? "").replace(/\s+/g, " ").trim();
    return number || insured || `Policy ${policyId}`;
  }

  const segment = path.split("/").filter(Boolean).pop() ?? path;
  return decodeURIComponent(segment).replace(/[-_]/g, " ");
}

function toSideNavLink(path: string, label: string): SideNavLink {
  return {
    id: recentIdForPath(path),
    label,
    href: path,
    caption: recentCaptionForPath(path),
  };
}

export async function listRecentRoutes(
  userId: string,
  limit = RECENT_ROUTES_MAX,
): Promise<SideNavLink[]> {
  const db = getDb();
  const rows = await db
    .select({
      path: appUserRecentRoute.path,
      label: appUserRecentRoute.label,
    })
    .from(appUserRecentRoute)
    .where(eq(appUserRecentRoute.userId, userId))
    .orderBy(desc(appUserRecentRoute.visitedWhen))
    .limit(limit);

  return rows.map((row) =>
    toSideNavLink(row.path, row.label.trim() || row.path),
  );
}

/**
 * Push `path` to the front of the user's Recents stack (max 5).
 * Re-visiting an existing path moves it to the top.
 */
export async function pushRecentRoute(
  userId: string,
  rawPath: string,
): Promise<SideNavLink[]> {
  const path = normalizeRecentPath(rawPath);
  if (!path) return listRecentRoutes(userId);

  const label = await resolveRecentRouteLabel(path);
  const db = getDb();

  await db
    .insert(appUserRecentRoute)
    .values({
      userId,
      path,
      label,
      visitedWhen: new Date(),
    })
    .onConflictDoUpdate({
      target: [appUserRecentRoute.userId, appUserRecentRoute.path],
      set: {
        label,
        visitedWhen: sql`now()`,
      },
    });

  const keep = await db
    .select({ path: appUserRecentRoute.path })
    .from(appUserRecentRoute)
    .where(eq(appUserRecentRoute.userId, userId))
    .orderBy(desc(appUserRecentRoute.visitedWhen))
    .limit(RECENT_ROUTES_MAX);

  const keepPaths = keep.map((row) => row.path);
  if (keepPaths.length > 0) {
    await db
      .delete(appUserRecentRoute)
      .where(
        and(
          eq(appUserRecentRoute.userId, userId),
          notInArray(appUserRecentRoute.path, keepPaths),
        ),
      );
  }

  return listRecentRoutes(userId);
}
