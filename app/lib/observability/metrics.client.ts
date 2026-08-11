/**
 * Browser product-usage metrics. Safe to call from client components/hooks.
 * No-ops when Sentry is not configured.
 */

export type ClientMetricAttributes = Record<
  string,
  string | number | boolean | undefined
>;

export function trackClientUsage(
  name: string,
  attributes?: ClientMetricAttributes,
  value = 1,
): void {
  void import("@sentry/react-router/cloudflare")
    .then((Sentry) => {
      Sentry.metrics.count(name, value, {
        attributes: compactAttributes(attributes),
      });
    })
    .catch(() => {
      // Sentry optional / failed to load
    });
}

export function trackClientDistribution(
  name: string,
  value: number,
  options?: { unit?: string; attributes?: ClientMetricAttributes },
): void {
  void import("@sentry/react-router/cloudflare")
    .then((Sentry) => {
      Sentry.metrics.distribution(name, value, {
        unit: options?.unit,
        attributes: compactAttributes(options?.attributes),
      });
    })
    .catch(() => {
      // Sentry optional / failed to load
    });
}

function compactAttributes(
  attributes?: ClientMetricAttributes,
): Record<string, string | number | boolean> | undefined {
  if (!attributes) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
