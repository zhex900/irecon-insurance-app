import type { CarExcesses } from "~/lib/db/types";

import { EXCESS_DEFAULT_FIELD_BY_ID, EXCESS_FIELDS } from "./field-catalogue";
import { normalizeExcessValue } from "./normalize";
import type { ExcessFieldKey, ExcessNoteFieldKey } from "./types";

/** Build flat defaultExcesses from PolicyCARExcessDefault catalogue rows. */
export function defaultExcessesFromCatalogue(
  rows: { policyCarExcessDefaultId: number; excess: string }[],
): Omit<CarExcesses, ExcessNoteFieldKey> {
  const result = Object.fromEntries(
    EXCESS_FIELDS.map(({ key }) => [key, ""]),
  ) as Record<ExcessFieldKey, string>;

  for (const row of rows) {
    const key = EXCESS_DEFAULT_FIELD_BY_ID[row.policyCarExcessDefaultId];
    if (!key) continue;
    result[key] = normalizeExcessValue(row.excess);
  }

  return result;
}
