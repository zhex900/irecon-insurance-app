/**
 * Per-user route history for the side nav Recents stack.
 */
import { and, desc, eq, notInArray, sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { appUserRecentRoute, client, policy, policyCar } from "~/lib/db/schema";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import { getLatestDocumentTemplate } from "~/lib/services/documents/document-templates";
import {
  matchRecentLeafSection,
  normalizeRecentPath,
  RECENT_ROUTES_MAX,
  recentCaptionForPath,
  recentIdForPath,
  type RecentLeafSection,
  recentTemplateNameFromKey,
} from "~/lib/services/navigation/recent-routes";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";

export {
  normalizeRecentPath,
  RECENT_ROUTES_MAX,
} from "~/lib/services/navigation/recent-routes";

const UUID_SEGMENT = "[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}";
const CLIENT_PATH_PATTERN = new RegExp(`^/clients/(${UUID_SEGMENT})(?:/|$)`);
const POLICY_PATH_PATTERN = new RegExp(`^/policies/(${UUID_SEGMENT})(?:/|$)`);

const STATIC_LABELS: Record<string, string> = {
  "/clients": "Clients",
  "/policies": "Policies",
  "/reports": "Reports",
  "/reports/car-policies": "CAR Policy Report",
  "/reports/car-renewals": "CAR Renewal Report",
  "/settings": "Settings",
  "/settings/users": "User Management",
  "/settings/ar-brokers": "Authorised Representatives",
  "/settings/account-managers": "Account Managers",
  "/settings/car-wording": "Additional Wording",
  "/settings/email-templates": "Email Templates",
  "/settings/library-documents": "Library Documents",
  "/settings/document-templates": "Document Templates",
  "/settings/features": "Features",
  "/settings/audit-log": "Audit Log",
  "/settings/prices": "Prices",
  "/profile": "Profile",
};

/**
 * Optional async leaf-label resolvers keyed by `RecentLeafSection.rootPath`.
 * Use when the leaf title lives in the DB (document templates, etc.).
 */
const ASYNC_LEAF_LABELS: Partial<
  Record<string, (leafId: string) => Promise<string | null>>
> = {
  "/settings/document-templates": async (key) => {
    const latest = await getLatestDocumentTemplate(key);
    if (!latest?.title.trim()) return null;
    return formatDocumentTemplateTitle(latest.title);
  },
};

async function resolveLeafLabel(
  section: RecentLeafSection,
  leafId: string,
): Promise<string> {
  const asyncLabel = ASYNC_LEAF_LABELS[section.rootPath];
  if (asyncLabel) {
    const resolved = await asyncLabel(leafId);
    if (resolved?.trim()) return resolved.trim();
  }
  return section.leafLabel(leafId);
}

export async function resolveRecentRouteLabel(path: string): Promise<string> {
  if (STATIC_LABELS[path]) return STATIC_LABELS[path];

  const leaf = matchRecentLeafSection(path);
  if (leaf) return resolveLeafLabel(leaf.section, leaf.leafId);

  const clientMatch = CLIENT_PATH_PATTERN.exec(path);
  if (clientMatch) {
    const clientId = clientMatch[1]!;
    const db = getDb();
    const [row] = await db
      .select({ name: client.name, tradingName: client.tradingName })
      .from(client)
      .where(eq(client.clientId, clientId))
      .limit(1);
    const name =
      row?.name.replace(/\s+/g, " ").trim() ||
      row?.tradingName.replace(/\s+/g, " ").trim();
    return name || "Client";
  }

  const policyMatch = POLICY_PATH_PATTERN.exec(path);
  if (policyMatch) {
    const policyId = policyMatch[1]!;
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
    return number || insured || "Policy";
  }

  const segment = path.split("/").filter(Boolean).pop() ?? path;
  return (
    decodeURIComponent(segment).replace(/[-_]/g, " ") ||
    recentTemplateNameFromKey(segment)
  );
}

/** Secondary Recents line — root nav for leaf pages, type for clients/policies. */
export async function resolveRecentRouteCaption(
  path: string,
): Promise<string | undefined> {
  return recentCaptionForPath(path);
}

async function toSideNavLink(
  path: string,
  label: string,
): Promise<SideNavLink> {
  return {
    id: recentIdForPath(path),
    label,
    href: path,
    caption: await resolveRecentRouteCaption(path),
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

  return Promise.all(
    rows
      .filter((row) => normalizeRecentPath(row.path) !== null)
      .map(async (row) => {
        const path = row.path;
        // Always refresh leaf-section labels (pattern + titles can change).
        const label = matchRecentLeafSection(path)
          ? await resolveRecentRouteLabel(path)
          : row.label.trim() || path;
        return toSideNavLink(path, label);
      }),
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
