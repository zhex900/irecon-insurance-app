export function ListShell() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      {/* Page header area */}
      <div className="border-b bg-background px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Document Templates
            </h1>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
          </div>
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {/* Main content area */}
      <div className="p-4 sm:p-6">
        <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
          <div className="flex flex-col gap-0">
            <div className="flex gap-4 border-b px-4 py-3">
              <div className="h-4 w-8 animate-pulse rounded bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </div>
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
              >
                <div className="size-8 animate-pulse rounded-lg bg-muted" />
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
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
                <div className="size-10 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}