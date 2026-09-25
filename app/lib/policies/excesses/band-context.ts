import type { ExcessBandContext } from "./types";

export function normalizeExcessBandContext(
  context?: unknown | ExcessBandContext,
): ExcessBandContext {
  if (context == null) return {};
  if (typeof context === "object" && !Array.isArray(context)) {
    return context as ExcessBandContext;
  }
  return { contractWorksSumInsured: context };
}
