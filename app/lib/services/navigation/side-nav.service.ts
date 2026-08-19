/**
 * Data for the app shell hierarchical side nav.
 */
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import type { AppUser } from "~/lib/db/types";
import { getFeatureFlagStates } from "~/lib/services/feature-flags";
import { listRecentRoutes } from "~/lib/services/navigation/recent-routes.server";

export type SideNavLink = {
  id: string;
  label: string;
  href: string;
  /** Secondary line under the label (parent section or entity type). */
  caption: string;
};

export type SideNavData = {
  recentRoutes: SideNavLink[];
  reports: SideNavLink[];
  settings: SideNavLink[];
};

const REPORT_LINKS: SideNavLink[] = [
  {
    id: "report-car-policies",
    label: "CAR Policy Report",
    href: "/reports/car-policies",
    caption: "Reports",
  },
  {
    id: "report-car-renewals",
    label: "CAR Renewal Report",
    href: "/reports/car-renewals",
    caption: "Reports",
  },
];

async function listSettingsLinks(viewer: AppUser): Promise<SideNavLink[]> {
  const superAdmin = isSuperAdmin(viewer);
  const admin = isAdminRole(viewer);
  const flags = await getFeatureFlagStates();
  const auditLogEnabled = flags.audit_log;
  const pricesEnabled = flags.prices;
  const emailTemplatesEnabled = flags.email_templates;
  const libraryDocumentsEnabled = flags.library_documents;
  const documentTemplatesEnabled = flags.document_templates;
  const additionalWordingEnabled = flags.additional_wording;
  const accountManagersEnabled = flags.account_managers;

  const links: SideNavLink[] = [];

  if (admin) {
    links.push({
      id: "settings-users",
      label: "User Management",
      href: "/settings/users",
      caption: "Settings",
    });
  }

  if (admin) {
    links.push({
      id: "settings-ar-brokers",
      label: "Authorised Representatives",
      href: "/settings/ar-brokers",
      caption: "Settings",
    });
  }

  if (admin && (accountManagersEnabled || superAdmin)) {
    links.push({
      id: "settings-account-managers",
      label: "Account Managers",
      href: "/settings/account-managers",
      caption: "Settings",
    });
  }

  if (additionalWordingEnabled || superAdmin) {
    links.push({
      id: "settings-car-wording",
      label: "Additional Wording",
      href: "/settings/car-wording",
      caption: "Settings",
    });
  }

  if (emailTemplatesEnabled || superAdmin) {
    links.push({
      id: "settings-email-templates",
      label: "Email Templates",
      href: "/settings/email-templates",
      caption: "Settings",
    });
  }
  if (libraryDocumentsEnabled || superAdmin) {
    links.push({
      id: "settings-library-documents",
      label: "Library Documents",
      href: "/settings/library-documents",
      caption: "Settings",
    });
  }
  if (documentTemplatesEnabled || superAdmin) {
    links.push({
      id: "settings-document-templates",
      label: "Document Templates",
      href: "/settings/document-templates",
      caption: "Settings",
    });
  }
  if (superAdmin) {
    links.push({
      id: "settings-features",
      label: "Features",
      href: "/settings/features",
      caption: "Settings",
    });
  }
  if (auditLogEnabled || superAdmin) {
    links.push({
      id: "settings-audit-log",
      label: "Audit Log",
      href: "/settings/audit-log",
      caption: "Settings",
    });
  }
  if (pricesEnabled || superAdmin) {
    links.push({
      id: "settings-prices",
      label: "Prices",
      href: "/settings/prices/car-rates",
      caption: "Settings",
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
