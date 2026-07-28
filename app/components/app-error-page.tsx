import { useState } from "react";
import { isRouteErrorResponse, Link } from "react-router";
import { ErrorPageIllustration } from "~/components/error-page-illustration";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function formatErrorDetails(error: unknown): {
  heading: string;
  subheading: string;
  details: string;
  status: number;
  stack?: string;
} {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        heading: "Oops!",
        subheading: "Page not found",
        details: "The requested page could not be found.",
        status: 404,
        stack:
          typeof error.data === "string"
            ? error.data
            : error.data != null
              ? JSON.stringify(error.data, null, 2)
              : error.statusText || undefined,
      };
    }

    return {
      heading: "Oops!",
      subheading: "Unexpected Server Error",
      details: error.statusText || "An unexpected error occurred.",
      status: error.status || 500,
      stack:
        typeof error.data === "string"
          ? error.data
          : error.data != null
            ? JSON.stringify(error.data, null, 2)
            : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      heading: "Oops!",
      subheading: "Unexpected Server Error",
      details: error.message || "An unexpected error occurred.",
      status: 500,
      stack: error.stack,
    };
  }

  if (error != null) {
    return {
      heading: "Oops!",
      subheading: "Unexpected Server Error",
      details: "An unexpected error occurred.",
      status: 500,
      stack: String(error),
    };
  }

  return {
    heading: "Oops!",
    subheading: "Unexpected Server Error",
    details: "An unexpected error occurred.",
    status: 500,
  };
}

/** Catch-all error / 404 UI used by the root ErrorBoundary. */
export function AppErrorPage({ error }: { error: unknown }) {
  const { heading, subheading, details, status, stack } =
    formatErrorDetails(error);
  const [showError, setShowError] = useState(false);
  const errorDump =
    stack ||
    [
      `Status: ${status}`,
      subheading,
      details,
      error != null && !(error instanceof Error) && !isRouteErrorResponse(error)
        ? String(error)
        : null,
    ]
      .filter(Boolean)
      .join("\n");

  return (
    <main className="flex min-h-svh flex-col items-center bg-background px-4 pt-[max(3rem,12vh)] pb-12 text-foreground">
      <div className="w-full max-w-lg shrink-0 text-center">
        <ErrorPageIllustration
          className="mx-auto h-auto w-full max-w-xs"
          title={subheading}
        />
        <p className="mt-6 text-6xl font-semibold tracking-tight text-foreground tabular-nums">
          {status}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {heading}
        </h1>
        <p className="mt-1 text-lg text-muted-foreground">{subheading}</p>
        <p className="mt-3 text-sm text-muted-foreground">{details}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard" className={cn(buttonVariants())}>
            Go to dashboard
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowError((open) => !open)}
          >
            {showError ? "Hide error" : "Show error"}
          </Button>
        </div>
      </div>

      {showError ? (
        <div className="mt-10 w-full max-w-3xl shrink-0">
          <p className="mb-2 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Stack trace
          </p>
          <pre className="max-h-[40vh] overflow-auto rounded-xl border bg-muted/40 p-4 text-left text-xs leading-relaxed text-foreground">
            <code>{errorDump || "No stack trace available."}</code>
          </pre>
        </div>
      ) : null}
    </main>
  );
}
