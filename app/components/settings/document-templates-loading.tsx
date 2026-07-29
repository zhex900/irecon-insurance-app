import { PageHeader } from "~/components/layout/app-layout";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import { cn } from "~/lib/utils";

/** Skeleton for the document templates card grid (header stays real). */
export function DocumentTemplatesListSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      role="status"
      aria-label="Loading document templates"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-xl border border-border p-6"
        >
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the pdfme designer pane only. */
export function DocumentTemplatesEditorSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[70vh] flex-1 flex-col gap-3 overflow-hidden rounded-xl border bg-background p-4",
        className,
      )}
      role="status"
      aria-label="Loading template editor"
    >
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="ml-auto h-9 w-20" />
      </div>
      <Skeleton className="min-h-0 w-full flex-1 rounded-lg" />
    </div>
  );
}

/** Hydrate / pending shell: real page title, skeleton for the editor body. */
export function DocumentTemplatesEditorShell({
  title = "Document Template",
  description = "Loading template…",
}: {
  title?: string;
  description?: string;
}) {
  const displayTitle = formatDocumentTemplateTitle(title);
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <PageHeader
        title={displayTitle}
        description={description}
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Document Templates", to: "/settings/document-templates" },
          { label: displayTitle },
        ]}
      />
      <DocumentTemplatesEditorSkeleton />
    </div>
  );
}

/** Hydrate / pending shell for the templates list. */
export function DocumentTemplatesListShell() {
  return (
    <div>
      <PageHeader
        title="Document Templates"
        description="Edit drafts, publish the live version used for PDF generation, and undo to a previous publish."
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Document Templates" },
        ]}
      />
      <DocumentTemplatesListSkeleton />
    </div>
  );
}
