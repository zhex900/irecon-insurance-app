/**
 * Data for the app shell hierarchical side nav.
 */
import type { AppUser } from "~/lib/db/types";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import { listRecentRoutes } from "~/lib/services/navigation/recent-routes.server";

export type SideNavLink = {
  id: string;
  label: string;
  href: string;
  /** Secondary line under the label (Client/Policy type, or template name). */
  caption?: string;
};

export type SideNavData = {
  recentRoutes: SideNavLink[];
  reports: SideNavLink[];
  settings: SideNavLink[];
};

const REPORT_LINKS: SideNavLink[] = [
  {
    id: "report-clients",
    label: "Client Report",
    href: "/reports/clients",
  },
  {
    id: "report-car-policies",
    label: "CAR Policy Report",
    href: "/reports/car-policies",
  },
  {
    id: "report-car-renewals",
    label: "CAR Renewal Report",
    href: "/reports/car-renewals",
  },
];

async function listSettingsLinks(viewer: AppUser): Promise<SideNavLink[]> {
  const superAdmin = isSuperAdmin(viewer);
  const admin = isAdminRole(viewer);
  const [
    auditLogEnabled,
    pricesEnabled,
    emailTemplatesEnabled,
    libraryDocumentsEnabled,
    documentTemplatesEnabled,
    additionalWordingEnabled,
  ] = await Promise.all([
    isFeatureEnabled("audit_log"),
    isFeatureEnabled("prices"),
    isFeatureEnabled("email_templates"),
    isFeatureEnabled("library_documents"),
    isFeatureEnabled("document_templates"),
    isFeatureEnabled("additional_wording"),
  ]);

  const links: SideNavLink[] = [];

  if (admin) {
    links.push({
      id: "settings-users",
      label: "User Management",
      href: "/settings/users",
    });
  }

  if (admin) {
    links.push({
      id: "settings-ar-brokers",
      label: "Authorised Representatives",
      href: "/settings/ar-brokers",
    });
  }

  if (additionalWordingEnabled || superAdmin) {
    links.push({
      id: "settings-car-wording",
      label: "Additional Wording",
      href: "/settings/car-wording",
    });
  }

  if (emailTemplatesEnabled || superAdmin) {
    links.push({
      id: "settings-email-templates",
      label: "Email Templates",
      href: "/settings/email-templates",
    });
  }
  if (libraryDocumentsEnabled || superAdmin) {
    links.push({
      id: "settings-library-documents",
      label: "Library Documents",
      href: "/settings/library-documents",
    });
  }
  if (documentTemplatesEnabled || superAdmin) {
    links.push({
      id: "settings-document-templates",
      label: "Document Templates",
      href: "/settings/document-templates",
    });
  }
  if (superAdmin) {
    links.push({
      id: "settings-features",
      label: "Features",
      href: "/settings/features",
    });
  }
  if (auditLogEnabled || superAdmin) {
    links.push({
      id: "settings-audit-log",
      label: "Audit Log",
      href: "/settings/audit-log",
    });
  }
  if (pricesEnabled || superAdmin) {
    links.push({
      id: "settings-prices",
      label: "Prices",
      href: "/settings/prices/car-rates",
    });
  }

  return links;
}

/** True when the viewer has at least one Settings destination (nav + /settings hub). */
export async function viewerCanAccessSettings(
  viewer: AppUser,
): Promise<boolean> {
  const links = await listSettingsLinks(viewer);
  return links.length > 0;
}

export async function getSideNavData(viewer: AppUser): Promise<SideNavData> {
  const [recentRoutes, settings] = await Promise.all([
    listRecentRoutes(viewer.userId),
    listSettingsLinks(viewer),
  ]);

  return {
    recentRoutes,
    reports: REPORT_LINKS.slice(0, 4),
    settings,
  };
}
