import { useEffect, useState } from "react";
import { isRouteErrorResponse, Link } from "react-router";
import { ErrorPageIllustration } from "~/components/error-page-illustration";
import { Button, buttonVariants } from "~/components/ui/button";
import { getResourceNotFoundCopy } from "~/lib/http/resource-not-found";
import { reportClientRouteError } from "~/lib/observability/report-error";
import { cn } from "~/lib/utils";

function formatErrorDetails(error: unknown): {
  heading: string;
  subheading: string;
  details: string;
  status: number;
  stack?: string;
} {
  const showDebugDetails = import.meta.env.DEV;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      const message =
        typeof error.data === "string" ? error.data.trim() : "";
      const resourceCopy = message ? getResourceNotFoundCopy(message) : null;
      if (resourceCopy) {
        return {
          heading: "Oops!",
          subheading: resourceCopy.subheading,
          details: resourceCopy.details,
          status: 404,
          stack: showDebugDetails ? message || undefined : undefined,
        };
      }

      const isUnknownRoute = message.startsWith("No route matches");
      return {
        heading: "Oops!",
        subheading: isUnknownRoute || !message ? "Page not found" : message,
        details: isUnknownRoute || !message
          ? "The requested page could not be found."
          : "The requested resource could not be found.",
        status: 404,
        stack: showDebugDetails
          ? message ||
            (error.data != null ? JSON.stringify(error.data, null, 2) : undefined) ||
            error.statusText ||
            undefined
          : undefined,
      };
    }

    if (error.status === 403) {
      const details =
        typeof error.data === "string" && error.data.trim()
          ? error.data.trim()
          : "You are not authorised for this page.";
      return {
        heading: "Access denied",
        subheading: "Not authorised",
        details,
        status: 403,
        stack: showDebugDetails ? error.statusText || undefined : undefined,
      };
    }

    return {
      heading: "Oops!",
      subheading: "Unexpected Server Error",
      details:
        error.status >= 500
          ? "An unexpected error occurred."
          : error.statusText || "The request could not be completed.",
      status: error.status || 500,
      stack: showDebugDetails
        ? typeof error.data === "string"
          ? error.data
          : error.data != null
            ? JSON.stringify(error.data, null, 2)
            : undefined
        : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      heading: "Oops!",
      subheading: "Unexpected Server Error",
      details: "An unexpected error occurred.",
      status: 500,
      stack: showDebugDetails ? error.stack : undefined,
    };
  }

  if (error != null) {
    return {
      heading: "Oops!",
      subheading: "Unexpected Server Error",
      details: "An unexpected error occurred.",
      status: 500,
      stack: showDebugDetails ? String(error) : undefined,
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

  useEffect(() => {
    reportClientRouteError(error);
  }, [error]);
  const showDebugDetails = import.meta.env.DEV;
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
          {showDebugDetails ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowError((open) => !open)}
            >
              {showError ? "Hide error" : "Show error"}
            </Button>
          ) : null}
        </div>
      </div>

      {showDebugDetails && showError ? (
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
