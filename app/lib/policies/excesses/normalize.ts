import type { CarExcesses } from "~/lib/db/types";

import { normalizeExcessBandContext } from "./band-context";
import { EXCESS_FIELDS } from "./field-catalogue";
import { migrateLegacyExcessKeys } from "./legacy-migration";
import { relocateExcessesToActiveBand } from "./relocate";
import type { ExcessBandContext, ExcessFieldKey } from "./types";

/** Strip $ / commas / wording so the form stores a bare number. */
export function normalizeExcessValue(value: string | undefined): string {
  if (value == null) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^n\/a$/i.test(trimmed)) return "N/A";
  const match = trimmed.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match?.[0] ?? "";
}

export function normalizeExcesses(
  excesses: CarExcesses | Record<string, string | undefined>,
  context?: unknown | ExcessBandContext,
): CarExcesses {
  const migrated = migrateLegacyExcessKeys(excesses);
  const numeric = Object.fromEntries(
    EXCESS_FIELDS.map(({ key }) => [key, normalizeExcessValue(migrated[key])]),
  ) as Pick<CarExcesses, ExcessFieldKey>;

  const normalized: CarExcesses = {
    ...numeric,
    excessAdditionalNotes: migrated.excessAdditionalNotes ?? "",
    excessLegalLiabilityAdditionalNotes:
      migrated.excessLegalLiabilityAdditionalNotes ?? "",
  };

  const bandContext = normalizeExcessBandContext(context);
  const hasBandInput =
    bandContext.contractWorksSumInsured != null ||
    bandContext.liabilityLimitBand != null;
  return hasBandInput
    ? relocateExcessesToActiveBand(normalized, bandContext)
    : normalized;
}
