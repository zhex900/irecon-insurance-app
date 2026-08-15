import {
  ArrowRightIcon,
  BadgeDollarSignIcon,
  ContactIcon,
  FilePenLineIcon,
  FileStackIcon,
  FileTextIcon,
  MailIcon,
  ScrollTextIcon,
  SlidersHorizontalIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import { Link, useNavigation } from "react-router";
import { PageHeader } from "~/components/layout/app-layout";
import {
  EditorShell,
  ListShell,
} from "~/components/documents/templates/loading";
import { ThemeModePicker } from "~/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { requireAuth } from "~/lib/auth/session.server";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { throwUnauthorizedPage } from "~/lib/auth/authorize.server";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import { viewerCanAccessSettings } from "~/lib/services/navigation/side-nav.service";
import type { Route } from "./+types/_index";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Settings") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  if (!(await viewerCanAccessSettings(viewer))) {
    throwUnauthorizedPage();
  }
  const [
    auditLogEnabled,
    pricesEnabled,
    emailTemplatesEnabled,
    libraryDocumentsEnabled,
    documentTemplatesEnabled,
    additionalWordingEnabled,
    accountManagersEnabled,
  ] = await Promise.all([
    isFeatureEnabled("audit_log"),
    isFeatureEnabled("prices"),
    isFeatureEnabled("email_templates"),
    isFeatureEnabled("library_documents"),
    isFeatureEnabled("document_templates"),
    isFeatureEnabled("additional_wording"),
    isFeatureEnabled("account_managers"),
  ]);
  const superAdmin = isSuperAdmin(viewer);
  return {
    showUsers: isAdminRole(viewer),
    showAuthorisedRepresentatives: isAdminRole(viewer),
    showAccountManagers:
      isAdminRole(viewer) && (accountManagersEnabled || superAdmin),
    showFeatures: superAdmin,
    showEmailTemplates: emailTemplatesEnabled || superAdmin,
    showLibraryDocuments: libraryDocumentsEnabled || superAdmin,
    showDocumentTemplates: documentTemplatesEnabled || superAdmin,
    showAdditionalWording: additionalWordingEnabled || superAdmin,
    showPrices: pricesEnabled || superAdmin,
    showAuditLog: auditLogEnabled || superAdmin,
    auditLogEnabled,
    pricesEnabled,
    emailTemplatesEnabled,
    libraryDocumentsEnabled,
    documentTemplatesEnabled,
    additionalWordingEnabled,
    accountManagersEnabled,
  };
}

export default function SettingsIndexRoute({
  loaderData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const documentTemplatesPath = navigation.location?.pathname ?? "";
  const loadingDocumentTemplates =
    navigation.state !== "idle" &&
    documentTemplatesPath.startsWith("/settings/document-templates");

  if (loadingDocumentTemplates) {
    const editorMatch = documentTemplatesPath.match(
      /^\/settings\/document-templates\/([^/]+)/,
    );
    if (editorMatch) {
      return <EditorShell templateTitle="Document Template" />;
    }
    return <ListShell />;
  }

  const settingsItems = [
    ...(loaderData.showUsers
      ? [
          {
            to: "/settings/users",
            title: "User Management",
            description: "Manage users and their permissions.",
            icon: UserCogIcon,
          },
        ]
      : []),
    ...(loaderData.showAuthorisedRepresentatives
      ? [
          {
            to: "/settings/ar-brokers",
            title: "Authorised Representatives",
            description:
              "Search, add, edit, and remove authorised representative brokers used on clients.",
            icon: UsersIcon,
          },
        ]
      : []),
    ...(loaderData.showAccountManagers
      ? [
          {
            to: "/settings/account-managers",
            title: "Account Managers",
            description: loaderData.accountManagersEnabled
              ? "Search, add, edit, and remove account managers assigned to clients."
              : "Account Managers is disabled for other roles. Super-admins can still manage it.",
            icon: ContactIcon,
          },
        ]
      : []),
    ...(loaderData.showAdditionalWording
      ? [
          {
            to: "/settings/car-wording",
            title: "Additional Wording",
            description: loaderData.additionalWordingEnabled
              ? "Manage the endorsement wording catalogue used on the policy Additional Wording step."
              : "Additional Wording is disabled for other roles. Super-admins can still manage it.",
            icon: FileTextIcon,
          },
        ]
      : []),
    ...(loaderData.showEmailTemplates
      ? [
          {
            to: "/settings/email-templates",
            title: "Email Templates",
            description: loaderData.emailTemplatesEnabled
              ? "Set broker and insurer document email templates and the insurer address."
              : "Email Templates is disabled for other roles. Super-admins can still view it.",
            icon: MailIcon,
          },
        ]
      : []),
    ...(loaderData.showLibraryDocuments
      ? [
          {
            to: "/settings/library-documents",
            title: "Library Documents",
            description: loaderData.libraryDocumentsEnabled
              ? "Upload and manage static PDFs attached to CAR document packs."
              : "Library Documents is disabled for other roles. Super-admins can still manage it.",
            icon: FileStackIcon,
          },
        ]
      : []),
    ...(loaderData.showDocumentTemplates
      ? [
          {
            to: "/settings/document-templates",
            title: "Document Templates",
            description: loaderData.documentTemplatesEnabled
              ? "Edit pdfme layouts for Schedule, ROA, and Adjustment PDFs."
              : "Document Templates is disabled for other roles. Super-admins can still manage it.",
            icon: FilePenLineIcon,
          },
        ]
      : []),
    ...(loaderData.showFeatures
      ? [
          {
            to: "/settings/features",
            title: "Features",
            description: "Enable or disable product features.",
            icon: SlidersHorizontalIcon,
          },
        ]
      : []),
    ...(loaderData.showAuditLog
      ? [
          {
            to: "/settings/audit-log",
            title: "Audit Log",
            description: loaderData.auditLogEnabled
              ? "Trace material actions. Admins see everyone; brokers see their own activity."
              : "Audit Log is disabled for other roles. Super-admins can still view it.",
            icon: ScrollTextIcon,
          },
        ]
      : []),
    ...(loaderData.showPrices
      ? [
          {
            to: "/settings/prices/car-rates",
            title: "Prices",
            description: loaderData.pricesEnabled
              ? "Manage CAR rate, stamp duty, ESL, plant, terrorism, and fee catalogues."
              : "Prices is disabled for other roles. Super-admins can still manage it.",
            icon: BadgeDollarSignIcon,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Admin configuration for brokers and reference data."
        breadcrumbs={[{ label: "Settings" }]}
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>
              Choose light, dark, or match your system preference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeModePicker className="max-w-md" />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {settingsItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              prefetch="intent"
              className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="pointer-events-none h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="size-5" />
                    </span>
                    <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
