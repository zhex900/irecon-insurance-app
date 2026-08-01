/**
 * Per-user route history for the side nav Recents stack.
 */
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { appUserRecentRoute, client, policy, policyCar } from "~/lib/db/schema";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_META,
  type EmailTemplateKey,
} from "~/lib/email-templates";
import { getLatestDocumentTemplate } from "~/lib/services/documents/document-templates";
import {
  normalizeRecentPath,
  recentCaptionForPath,
  recentIdForPath,
  recentTemplateNameFromKey,
  RECENT_ROUTES_MAX,
} from "~/lib/services/navigation/recent-routes";
import type { SideNavLink } from "~/lib/services/navigation/side-nav.service";

export {
  normalizeRecentPath,
  RECENT_ROUTES_MAX,
} from "~/lib/services/navigation/recent-routes";

const STATIC_LABELS: Record<string, string> = {
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

function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export async function resolveRecentRouteLabel(path: string): Promise<string> {
  if (STATIC_LABELS[path]) return STATIC_LABELS[path];

  if (/^\/settings\/email-templates\/[^/]+$/.test(path)) {
    return "Email Template";
  }
  if (/^\/settings\/document-templates\/[^/]+$/.test(path)) {
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

/** Secondary Recents line — type for clients/policies, name for templates. */
export async function resolveRecentRouteCaption(
  path: string,
): Promise<string | undefined> {
  if (/^\/clients\/\d+(?:\/|$)/.test(path)) return "Client";
  if (/^\/policies\/\d+(?:\/|$)/.test(path)) return "Policy";

  const emailMatch = /^\/settings\/email-templates\/([^/]+)$/.exec(path);
  if (emailMatch) {
    const key = decodeURIComponent(emailMatch[1] ?? "");
    if (isEmailTemplateKey(key)) return EMAIL_TEMPLATE_META[key].title;
    return recentTemplateNameFromKey(key);
  }

  const docMatch = /^\/settings\/document-templates\/([^/]+)$/.exec(path);
  if (docMatch) {
    const key = decodeURIComponent(docMatch[1] ?? "");
    const latest = await getLatestDocumentTemplate(key);
    if (latest?.title.trim()) {
      return formatDocumentTemplateTitle(latest.title);
    }
    return recentTemplateNameFromKey(key);
  }

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
        // Template editor rows store the type as label; refresh if older rows
        // still have a path-key label from before captions were added.
        const isTemplateEditor =
          /^\/settings\/email-templates\/[^/]+$/.test(path) ||
          /^\/settings\/document-templates\/[^/]+$/.test(path);
        const label = isTemplateEditor
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
