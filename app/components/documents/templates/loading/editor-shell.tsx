import type { ReactNode } from "react";
import { PageHeader } from "~/components/layout/app-layout";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import { cn } from "~/lib/utils";

export function EditorShell({
  children,
  templateTitle = "Document Template",
  pageBreadcrumbs = [],
  headerActions,
  className,
}: {
  children?: ReactNode;
  templateTitle?: string;
  pageBreadcrumbs?: Array<{ id: string; label: string }>;
  headerActions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {/* Page header area */}
      <PageHeader
        title={formatDocumentTemplateTitle(templateTitle)}
        breadcrumbs={pageBreadcrumbs}
        action={headerActions}
      />

      {/* Content area */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {children || (
          <>
            {/* Left column skeleton */}
            <div className="flex flex-col gap-4">
              <div className="h-8 w-40 animate-pulse rounded bg-muted" />
              <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted" />
              <div className="h-[300px] w-full animate-pulse rounded-xl bg-muted" />
            </div>
            {/* Right column skeleton */}
            <div className="flex flex-col gap-4">
              <div className="h-8 w-32 animate-pulse rounded bg-muted" />
              <div className="h-[560px] w-full animate-pulse rounded-xl bg-muted" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
