import { PageHeader } from "~/components/layout/app-layout";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import { cn } from "~/lib/utils";

/** Skeleton for the document templates list (table on desktop, cards on mobile). */
function DocumentTemplatesListSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(className)}
      role="status"
      aria-label="Loading document templates"
    >
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="flex flex-col gap-0">
          <div className="flex gap-4 border-b px-4 py-3">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl border border-border p-6"
          >
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
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
        "flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl border bg-background p-4",
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
    <div className="flex h-[calc(100svh-3.5rem-2rem)] flex-col gap-4 md:h-[calc(100svh-3.5rem-4rem)]">
      <div className="shrink-0 [&>*]:mb-0">
        <PageHeader
          title={displayTitle}
          description={description}
          breadcrumbs={[
            { label: "Settings", to: "/settings" },
            { label: "Document Templates", to: "/settings/document-templates" },
            { label: displayTitle },
          ]}
        />
      </div>
      <DocumentTemplatesEditorSkeleton className="min-h-0 flex-1" />
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
