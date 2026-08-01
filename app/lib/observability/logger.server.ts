/**
 * Structured JSON logger for Workers Logs / OTEL → Sentry correlation.
 * Never log passwords, tokens, cookies, or policy/client PII payloads.
 */
/* eslint-disable no-console -- this module is the approved project logger */
import {
  getRequestContext,
  type RequestContext,
} from "~/lib/observability/request-context.server";

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean | null | undefined>;

function write(
  level: LogLevel,
  message: string,
  fields?: LogFields,
  ctx: RequestContext | undefined = getRequestContext(),
) {
  const entry = {
    level,
    message,
    requestId: ctx?.requestId,
    userId: ctx?.userId,
    route: ctx?.route,
    ...fields,
    ts: new Date().toISOString(),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) =>
    write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) =>
    write("error", message, fields),
};
