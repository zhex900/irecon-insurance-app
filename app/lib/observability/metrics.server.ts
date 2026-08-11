/**
 * Product-usage metrics for Worker / SSR.
 * Prefer low-cardinality attributes (enums, route groups) — not user/request IDs.
 */
import { Sentry } from "~/lib/observability/sentry.server";

export type MetricAttributes = Record<
  string,
  string | number | boolean | undefined
>;

/** Count a product event (how many times something happened). */
export function trackUsage(
  name: string,
  attributes?: MetricAttributes,
  value = 1,
): void {
  Sentry.metrics.count(name, value, {
    attributes: compactAttributes(attributes),
  });
}

/** Record a measured duration / size distribution (p50/p95 in Sentry). */
export function trackDistribution(
  name: string,
  value: number,
  options?: { unit?: string; attributes?: MetricAttributes },
): void {
  Sentry.metrics.distribution(name, value, {
    unit: options?.unit,
    attributes: compactAttributes(options?.attributes),
  });
}

function compactAttributes(
  attributes?: MetricAttributes,
): Record<string, string | number | boolean> | undefined {
  if (!attributes) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
