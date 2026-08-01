/**
 * Data for the app shell hierarchical side nav.
 */
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { client, policy, policyCar } from "~/lib/db/schema";
import type { AppUser } from "~/lib/db/types";
import { isSuperAdmin } from "~/lib/auth/roles";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import { listRecentRoutes } from "~/lib/services/navigation/recent-routes.server";
import { getReferenceData } from "~/lib/services/reference.service";

export type SideNavLink = {
  id: string;
  label: string;
  href: string;
  /** Secondary line under the label (Client/Policy type, or template name). */
  caption?: string;
};

export type SideNavClientPreview = SideNavLink & {
  clientId: number;
  name: string;
  tradingName: string;
  abn: string;
  phone: string;
  email: string;
  accountManagerName: string;
};

export type SideNavPolicyPreview = SideNavLink & {
  policyId: number;
  policyNumber: string;
  insuredName: string;
  clientName: string;
  policyStatusId: number;
  policyStatusName: string;
  coverTypeName: string;
  dateStart: string;
  dateEnd: string;
  isDraft: boolean;
};

export type SideNavData = {
  recentRoutes: SideNavLink[];
  recentClients: SideNavClientPreview[];
  recentPolicies: SideNavPolicyPreview[];
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

async function listRecentClients(limit = 4): Promise<SideNavClientPreview[]> {
  const db = getDb();
  const reference = getReferenceData();
  const managers = new Map(
    reference.accountManagers.map((m) => [m.accountManagerId, m.fullName]),
  );

  // Clients have no updated_when — use latest policy touch, else created_when.
  const rows = await db
    .select({
      clientId: client.clientId,
      name: client.name,
      tradingName: client.tradingName,
      abn: client.abn,
      phone: client.phone,
      email: client.email,
      accountManagerId: client.accountManagerId,
    })
    .from(client)
    .orderBy(
      desc(
        sql`coalesce(
          (select max(coalesce(p.updated_when, p.created_when))
           from policy p
           where p.client_id = ${client.clientId}),
          ${client.createdWhen}
        )`,
      ),
    )
    .limit(limit);

  return rows.map((row) => {
    const name =
      row.name.replace(/\s+/g, " ").trim() ||
      row.tradingName.replace(/\s+/g, " ").trim() ||
      "Untitled client";
    return {
      id: `client-${row.clientId}`,
      label: name,
      href: `/clients/${row.clientId}`,
      clientId: row.clientId,
      name,
      tradingName: row.tradingName.replace(/\s+/g, " ").trim(),
      abn: row.abn.trim(),
      phone: row.phone.trim(),
      email: row.email.trim(),
      accountManagerName: (managers.get(row.accountManagerId) ?? "")
        .replace(/\s+/g, " ")
        .trim(),
    };
  });
}

async function listRecentPolicies(limit = 4): Promise<SideNavPolicyPreview[]> {
  const db = getDb();
  const reference = getReferenceData();
  const statusById = new Map(
    reference.policyStatuses.map((s) => [s.policyStatusId, s.name]),
  );
  const coverById = new Map(
    reference.coverTypes.map((c) => [c.coverTypeId, c.name]),
  );

  const rows = await db
    .select({
      policyId: policy.policyId,
      policyNumber: policy.policyNumber,
      policyStatusId: policy.policyStatusId,
      dateStart: policy.dateStart,
      dateEnd: policy.dateEnd,
      isDraft: policy.isDraft,
      insuredName: policyCar.insuredName,
      coverTypeId: policyCar.coverTypeId,
      clientName: client.name,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .orderBy(desc(sql`coalesce(${policy.updatedWhen}, ${policy.createdWhen})`))
    .limit(limit);

  return rows.map((row) => {
    const number = row.policyNumber.replace(/\s+/g, " ").trim();
    const insured = (row.insuredName ?? "").replace(/\s+/g, " ").trim();
    // Keep the nav label short — full details are in the hover preview.
    const label = number || insured || `Policy ${row.policyId}`;
    return {
      id: `policy-${row.policyId}`,
      label,
      href: `/policies/${row.policyId}`,
      policyId: row.policyId,
      policyNumber: number || `Policy ${row.policyId}`,
      insuredName: insured,
      clientName: (row.clientName ?? "").replace(/\s+/g, " ").trim() || "—",
      policyStatusId: row.policyStatusId,
      policyStatusName: statusById.get(row.policyStatusId) ?? "—",
      coverTypeName: coverById.get(row.coverTypeId) ?? "—",
      dateStart: row.dateStart.toISOString().slice(0, 10),
      dateEnd: row.dateEnd.toISOString().slice(0, 10),
      isDraft: Boolean(row.isDraft),
    };
  });
}

async function listSettingsLinks(viewer: AppUser): Promise<SideNavLink[]> {
  const superAdmin = isSuperAdmin(viewer);
  const [
    auditLogEnabled,
    pricesEnabled,
    emailTemplatesEnabled,
    libraryDocumentsEnabled,
    documentTemplatesEnabled,
  ] = await Promise.all([
    isFeatureEnabled("audit_log"),
    isFeatureEnabled("prices"),
    isFeatureEnabled("email_templates"),
    isFeatureEnabled("library_documents"),
    isFeatureEnabled("document_templates"),
  ]);

  const links: SideNavLink[] = [
    {
      id: "settings-users",
      label: "User Management",
      href: "/settings/users",
    },
    {
      id: "settings-ar-brokers",
      label: "Authorised Representatives",
      href: "/settings/ar-brokers",
    },
  ];

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

export async function getSideNavData(viewer: AppUser): Promise<SideNavData> {
  const [recentRoutes, recentClients, recentPolicies, settings] =
    await Promise.all([
      listRecentRoutes(viewer.userId),
      listRecentClients(4),
      listRecentPolicies(4),
      listSettingsLinks(viewer),
    ]);

  return {
    recentRoutes,
    recentClients,
    recentPolicies,
    reports: REPORT_LINKS.slice(0, 4),
    settings,
  };
}
