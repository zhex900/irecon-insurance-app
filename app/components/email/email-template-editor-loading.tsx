import { PageHeader } from "~/components/layout/app-layout";
import { Skeleton } from "~/components/ui/skeleton";

export function EmailTemplateEditorSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-label="Loading email template editor"
    >
      <div className="flex max-w-5xl flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-[min(36rem,65vh)] min-h-80 w-full rounded-lg" />
        </div>

        <div className="hidden flex-col gap-3 lg:flex">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmailTemplateEditorShell({
  title = "Email Template",
  description = "Loading template…",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Email Templates", to: "/settings/email-templates" },
          { label: title },
        ]}
      />
      <EmailTemplateEditorSkeleton />
    </div>
  );
}
