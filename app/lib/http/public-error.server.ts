import { z } from "zod";

import { formatDbErrorChain } from "~/lib/db/query-gate";
import { DomainError } from "~/lib/errors";
import { logger } from "~/lib/observability/logger.server";
import { captureServerException } from "~/lib/observability/sentry.server";

type PublicErrorOptions = {
  fallback: string;
  operation: string;
};

function zodIssueFields(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
  }));
}

/** Return safe client copy; log + Sentry unexpected failures (no payloads / PII). */
export function publicErrorMessage(
  error: unknown,
  { fallback, operation }: PublicErrorOptions,
): string {
  if (error instanceof DomainError) return error.message;
  if (error instanceof z.ZodError) {
    logger.warn("Submitted data failed validation", {
      operation,
      issues: JSON.stringify(zodIssueFields(error)),
    });
    return "The submitted data is invalid.";
  }
  if (error instanceof Response) throw error;

  logger.error("Unexpected route operation failure", {
    operation,
    errorType: error instanceof Error ? error.name : typeof error,
    errorMessage: formatDbErrorChain(error),
  });
  captureServerException(error, { operation });
  return fallback;
}
