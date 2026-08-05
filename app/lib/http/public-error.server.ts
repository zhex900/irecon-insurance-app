import { z } from "zod";
import { DomainError } from "~/lib/errors";
import { logger } from "~/lib/observability/logger.server";

type PublicErrorOptions = {
  fallback: string;
  operation: string;
};

/** Return safe client copy and log unexpected failures without payloads or PII. */
export function publicErrorMessage(
  error: unknown,
  { fallback, operation }: PublicErrorOptions,
): string {
  if (error instanceof DomainError) return error.message;
  if (error instanceof z.ZodError) return "The submitted data is invalid.";
  if (error instanceof Response) throw error;

  logger.error("Unexpected route operation failure", {
    operation,
    errorType: error instanceof Error ? error.name : typeof error,
  });
  return fallback;
}
