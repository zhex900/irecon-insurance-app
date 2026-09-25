import type { ExcessFieldKey } from "./types";

/** Old MSSQL PolicyCARExcess columns → flat form keys. */
const LEGACY_EXCESS_KEY: Record<string, ExcessFieldKey> = {
  excessSection1A: "excessPlantEquipment",
  excessSection1B: "excessUpTo2MMinorPerils",
  excessSection1E: "excessUpTo2MMajorPerils",
  excessSection1C: "excessOver2MMinorPerils",
  excessSection1D: "excessOver2MMajorPerils",
  excessSection2A: "excessWorkerToWorker",
  // Legacy DB uses 2B for $10M limit; 2C is usually N/A.
  excessSection2B: "excessUpTo2MLimit10M",
  excessSection2C: "excessUpTo2MLimit10M",
  excessSection2D: "excessUpTo2MLimit20M",
  excessSection2E: "excessOver2MLimit10M",
  excessSection2F: "excessOver2MLimit20M",
};

function isLegacyExcessEmpty(value: string | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^n\/a$/i.test(trimmed);
}

/** Upgrade legacy excessSection1A-style keys when loading stored JSON. */
export function migrateLegacyExcessKeys(
  excesses: Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(excesses ?? {})) {
    if (value != null) raw[key] = value;
  }
  for (const [oldKey, newKey] of Object.entries(LEGACY_EXCESS_KEY)) {
    const legacy = raw[oldKey];
    if (isLegacyExcessEmpty(legacy)) continue;
    if (isLegacyExcessEmpty(raw[newKey])) {
      raw[newKey] = legacy!;
    }
    delete raw[oldKey];
  }
  return raw;
}
