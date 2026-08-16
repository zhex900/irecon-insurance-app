import { Link, useFetcher, useNavigate, useNavigation } from "react-router";
import { useEffect, useRef, useState } from "react";
import { FilePenLineIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "~/components/layout/app-layout";
import {
  EditorShell,
  ListShell,
} from "~/components/documents/templates/loading";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { AppSelect } from "~/components/ui/app-select";
import { InteractiveTableRow } from "~/components/ui/interactive-table-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { requireAuth } from "~/lib/auth/session/server.server";
import { requireFeatureOrSuperAdminPage } from "~/lib/auth/authorize.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseFormIntent } from "~/lib/http/route-input";
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
import { formatDate, formatRelativeTimeAgo } from "~/lib/utils";
import type { Route } from "./+types/document-templates";

export function meta() {
  return [{ title: pageTitle("Document Templates") }];
}

/** Shown immediately while the list (or a template editor) is loading. */
export function HydrateFallback() {
  return <ListShell />;
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const enabled = await isFeatureEnabled("document_templates");
  requireFeatureOrSuperAdminPage(enabled, viewer);

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
  const intent = parseFormIntent(formData, ["create"]);
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
      error: publicErrorMessage(error, {
        fallback: "Failed to create document template.",
        operation: "document_template_create",
      }),
    };
  }
}

function coverTypeLabel(coverTypeId: number | null, templateKey?: string) {
  if (templateKey === "adjustment") return "Adjustment only";
  if (coverTypeId === 1) return "Annual";
  if (coverTypeId === 2) return "Single";
  if (coverTypeId === 3) return "Owner Builder";
  return "All cover types";
}

function versionLabel(template: DocumentTemplateListItem) {
  if (template.hasPublished && template.publishedVersionNumber != null) {
    const draft =
      template.latestVersionNumber != null &&
      template.latestVersionNumber !== template.publishedVersionNumber
        ? ` · draft v${template.latestVersionNumber}`
        : "";
    return `v${template.publishedVersionNumber}${draft}`;
  }
  if (template.latestVersionNumber != null) {
    return `Draft v${template.latestVersionNumber}`;
  }
  return "Draft";
}

function templateHref(key: string) {
  return `/settings/document-templates/${encodeURIComponent(key)}`;
}

function TemplateIcon() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <FilePenLineIcon className="size-4" />
    </span>
  );
}

function LastUpdatedCell({ updatedWhen }: { updatedWhen: string | null }) {
  if (!updatedWhen) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span>{formatDate(updatedWhen)}</span>
      <span className="text-xs text-muted-foreground">
        {formatRelativeTimeAgo(updatedWhen)}
      </span>
    </div>
  );
}

function TemplateCard({ template }: { template: DocumentTemplateListItem }) {
  return (
    <Link
      to={templateHref(template.key)}
      className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
        <CardHeader className="gap-3">
          <TemplateIcon />
          <CardTitle className="text-base">
            {formatDocumentTemplateTitle(template.title)}
          </CardTitle>
          <CardDescription>
            {coverTypeLabel(template.coverTypeId, template.key)} ·{" "}
            {versionLabel(template)}
          </CardDescription>
          {template.updatedWhen ? (
            <p className="text-xs text-muted-foreground">
              {formatDate(template.updatedWhen)} ·{" "}
              {formatRelativeTimeAgo(template.updatedWhen)}
            </p>
          ) : null}
        </CardHeader>
      </Card>
    </Link>
  );
}

function TemplatesTable({
  templates,
  onRowActivate,
}: {
  templates: DocumentTemplateListItem[];
  onRowActivate: (key: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" aria-label="Icon" />
            <TableHead>Title</TableHead>
            <TableHead className="w-44">Label</TableHead>
            <TableHead>Cover type</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Last updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => {
            const title = formatDocumentTemplateTitle(template.title);
            return (
              <InteractiveTableRow
                key={template.key}
                aria-label={`Open ${title}`}
                onActivate={() => onRowActivate(template.key)}
              >
                <TableCell>
                  <TemplateIcon />
                </TableCell>
                <TableCell className="font-medium">{title}</TableCell>
                <TableCell className="text-sm">
                  {template.label || "—"}
                </TableCell>
                <TableCell>
                  {coverTypeLabel(template.coverTypeId, template.key)}
                </TableCell>
                <TableCell>{versionLabel(template)}</TableCell>
                <TableCell>
                  <LastUpdatedCell updatedWhen={template.updatedWhen} />
                </TableCell>
              </InteractiveTableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function NewTemplateDialog({
  open,
  onOpenChange,
  fetcher,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
}) {
  const submitting = fetcher.state !== "idle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>
            A stable template key is generated from the title (not editable
            later).
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form method="post" className="flex flex-col gap-4">
          <input type="hidden" name="intent" value="create" />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-template-title">Title</FieldLabel>
              <Input
                id="new-template-title"
                name="title"
                placeholder="e.g. Annual Schedule"
                required
                disabled={submitting}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-template-cover">Cover type</FieldLabel>
              <AppSelect
                id="new-template-cover"
                name="coverTypeId"
                defaultValue="1"
                disabled={submitting}
                className="w-full"
                options={[
                  { value: "1", label: "Annual" },
                  { value: "2", label: "Single" },
                  { value: "3", label: "Owner Builder" },
                  { value: "all", label: "All cover types" },
                ]}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              Create template
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentTemplatesRoute({
  loaderData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();
  const handledRef = useRef<typeof fetcher.data>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

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
    return <EditorShell templateTitle="Document Template" />;
  }

  return (
    <div>
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
        action={
          loaderData.canEdit ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              New template
            </Button>
          ) : null
        }
      />

      {loaderData.templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No document templates in the database yet. Create one to start editing
          and publishing layouts for PDF generation.
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <TemplatesTable
              templates={loaderData.templates}
              onRowActivate={(key) => {
                void navigate(templateHref(key));
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:hidden">
            {loaderData.templates.map((template) => (
              <TemplateCard key={template.key} template={template} />
            ))}
          </div>
        </>
      )}

      {loaderData.canEdit ? (
        <NewTemplateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          fetcher={fetcher}
        />
      ) : null}
    </div>
  );
}
