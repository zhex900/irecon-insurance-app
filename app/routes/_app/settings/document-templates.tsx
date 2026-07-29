import { Link, redirect } from "react-router";
import { ArrowRightIcon, FilePenLineIcon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import { pageTitle } from "~/lib/brand";
import {
  listDocumentTemplates,
  type DocumentTemplateListItem,
} from "~/lib/services/documents/document-templates";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import type { Route } from "./+types/document-templates";

export function meta() {
  return [{ title: pageTitle("Document templates") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const enabled = await isFeatureEnabled("document_templates");
  if (!enabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }

  return {
    templates: await listDocumentTemplates(),
    documentTemplatesEnabled: enabled,
  };
}

function coverTypeLabel(coverTypeId: number | null) {
  if (coverTypeId === 1) return "Annual";
  if (coverTypeId === 2) return "Single";
  if (coverTypeId === 3) return "Owner Builder";
  return "All cover types";
}

function TemplateCard({ template }: { template: DocumentTemplateListItem }) {
  const status = template.hasPublished
    ? `Published v${template.publishedVersionNumber}`
    : "Using seed (nothing published)";
  const latest =
    template.latestVersionNumber != null &&
    template.latestVersionNumber !== template.publishedVersionNumber
      ? ` · latest draft v${template.latestVersionNumber}`
      : "";

  return (
    <Link
      to={`/settings/document-templates/${encodeURIComponent(template.key)}`}
      className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FilePenLineIcon className="size-5" />
            </span>
            <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <CardTitle className="text-base">{template.title}</CardTitle>
          <CardDescription>
            {template.documentTypeCode} · {coverTypeLabel(template.coverTypeId)}
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            {status}
            {latest}
            {template.updatedWhen
              ? ` · ${new Date(template.updatedWhen).toLocaleString()}`
              : ""}
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default function DocumentTemplatesRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <div>
      <PageHeader
        title="Document templates"
        description={
          loaderData.documentTemplatesEnabled
            ? "Edit drafts, publish the live version used for PDF generation, and undo to a previous publish."
            : "Document templates is disabled for other roles. Super-admins can still manage it."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Document templates" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loaderData.templates.map((template) => (
          <TemplateCard key={template.key} template={template} />
        ))}
      </div>
    </div>
  );
}
