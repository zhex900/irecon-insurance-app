/**
 * Structured JSON logger for Workers Logs / OTEL → Sentry correlation.
 * Never log passwords, tokens, cookies, or policy/client PII payloads.
 *
 * warn/error also bridge to Sentry.logger when the SDK is initialized
 * (`enableLogs: true` on the Worker SDK).
 */
/* eslint-disable no-console -- this module is the approved project logger */
import {
  getRequestContext,
  type RequestContext,
} from "~/lib/observability/request-context.server";
import { Sentry } from "~/lib/observability/sentry.server";

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
    bridgeToSentry("error", message, fields, ctx);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    bridgeToSentry("warn", message, fields, ctx);
    return;
  }
  console.log(line);
}

function bridgeToSentry(
  level: "warn" | "error",
  message: string,
  fields: LogFields | undefined,
  ctx: RequestContext | undefined,
) {
  try {
    const attributes: Record<string, string | number | boolean> = {};
    if (ctx?.requestId) attributes.requestId = ctx.requestId;
    if (ctx?.route) attributes.route = ctx.route;
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (value == null) continue;
        attributes[key] = value;
      }
    }
    if (level === "error") {
      Sentry.logger.error(message, attributes);
      return;
    }
    Sentry.logger.warn(message, attributes);
  } catch {
    // Sentry optional / not initialized — console already wrote the line.
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) =>
    write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) =>
    write("error", message, fields),
};
