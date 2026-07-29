import {
  Link,
  redirect,
  useFetcher,
  useNavigate,
  useNavigation,
} from "react-router";
import { useEffect, useRef } from "react";
import { ArrowRightIcon, FilePenLineIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "~/components/layout/app-layout";
import {
  DocumentTemplatesEditorShell,
  DocumentTemplatesListShell,
} from "~/components/settings/document-templates-loading";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { requireAuth } from "~/lib/auth/session.server";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { pageTitle } from "~/lib/brand";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  createDocumentTemplate,
  createDocumentTemplateInputSchema,
  listDocumentTemplates,
  type DocumentTemplateListItem,
} from "~/lib/services/documents/document-templates";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import type { Route } from "./+types/document-templates";

export function meta() {
  return [{ title: pageTitle("Document Templates") }];
}

/** Shown immediately while the list (or a template editor) is loading. */
export function HydrateFallback() {
  return <DocumentTemplatesListShell />;
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
    canEdit: isAdminRole(viewer),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (!isAdminRole(viewer)) {
    return {
      ok: false as const,
      error: "Only admins can manage document templates.",
    };
  }

  const enabled = await isFeatureEnabled("document_templates");
  if (!enabled && !isSuperAdmin(viewer)) {
    return { ok: false as const, error: "Document templates is disabled." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  if (intent !== "create") {
    return { ok: false as const, error: "Unknown action." };
  }

  const coverRaw = String(formData.get("coverTypeId") ?? "");
  const coverTypeId =
    coverRaw === "all" || coverRaw === ""
      ? null
      : (Number(coverRaw) as 1 | 2 | 3);

  try {
    const parsed = createDocumentTemplateInputSchema.parse({
      coverTypeId,
      title: String(formData.get("title") ?? ""),
    });
    const created = await createDocumentTemplate(parsed, viewer.email);
    await writeAuditLog({
      actor: viewer,
      action: "settings.document_template_create",
      entityType: "document_template",
      entityId: created.documentTemplateKey,
      summary: `Created document template ${created.documentTemplateKey}`,
      metadata: {
        documentTemplateKey: created.documentTemplateKey,
        coverTypeId: created.coverTypeId,
      },
      request,
    });
    return {
      ok: true as const,
      intent: "create" as const,
      key: created.documentTemplateKey,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create document template.",
    };
  }
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
    : "Draft only (not published)";
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
          <CardTitle className="text-base">
            {formatDocumentTemplateTitle(template.title)}
          </CardTitle>
          <CardDescription>
            {template.key} · {coverTypeLabel(template.coverTypeId)}
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
  const navigation = useNavigation();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();
  const handledRef = useRef<typeof fetcher.data>(undefined);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (handledRef.current === fetcher.data) return;
    handledRef.current = fetcher.data;
    if (!fetcher.data.ok) {
      toast.error(fetcher.data.error);
      return;
    }
    toast.success(`Created ${fetcher.data.key}`);
    void navigate(
      `/settings/document-templates/${encodeURIComponent(fetcher.data.key)}`,
    );
  }, [fetcher.state, fetcher.data, navigate]);

  const editorMatch = navigation.location?.pathname.match(
    /^\/settings\/document-templates\/([^/]+)/,
  );
  const loadingEditor = navigation.state !== "idle" && Boolean(editorMatch);

  if (loadingEditor && editorMatch) {
    return <DocumentTemplatesEditorShell title="Document Template" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Document Templates"
        description={
          loaderData.documentTemplatesEnabled
            ? "Edit drafts, publish the live version used for PDF generation, and undo to a previous publish."
            : "Document Templates is disabled for other roles. Super-admins can still manage it."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Document Templates" },
        ]}
      />

      {loaderData.canEdit ? (
        <fetcher.Form
          method="post"
          className="grid max-w-3xl gap-3 rounded-xl border p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="intent" value="create" />
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Annual Schedule"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverTypeId">Cover type</Label>
            <select
              id="coverTypeId"
              name="coverTypeId"
              defaultValue="1"
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="1">Annual</option>
              <option value="2">Single</option>
              <option value="3">Owner Builder</option>
              <option value="all">All cover types</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            A stable template key is generated from the title (not editable
            later).
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={fetcher.state !== "idle"}>
              Create template
            </Button>
          </div>
        </fetcher.Form>
      ) : null}

      {loaderData.templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No document templates in the database yet. Create one to start editing
          and publishing layouts for PDF generation.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loaderData.templates.map((template) => (
            <TemplateCard key={template.key} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
