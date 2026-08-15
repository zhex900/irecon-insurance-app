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
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 md:hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EditorSkeleton({
  templateTitle = "Document Template",
  pageBreadcrumbs = [],
  className,
}: {
  templateTitle?: string;
  pageBreadcrumbs?: Array<{ id: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-xl", className)}>
      {/* Page header area */}
      <PageHeader
        title={formatDocumentTemplateTitle(templateTitle)}
        breadcrumbs={pageBreadcrumbs}
        action={
          <div className="flex animate-pulse flex-row items-center gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        }
      />

      {/* Content area */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* Left column: Editor controls */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>

        {/* Right column: PDF preview */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-[560px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}