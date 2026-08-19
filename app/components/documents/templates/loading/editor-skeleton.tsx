import { PageHeader } from "~/components/layout/app-layout";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import { cn } from "~/lib/utils";

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
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-xl",
        className,
      )}
    >
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
