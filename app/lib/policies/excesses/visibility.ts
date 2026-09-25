import {
  resolveContractValueBand,
  resolvePerilsStorageBand,
} from "./contract-works-band";
import { EXCESS_FIELDS } from "./field-catalogue";
import {
  isLegalLiabilityInsured,
  resolveLiabilityLimitMillions,
} from "./legal-liability";
import type {
  ExcessBandContext,
  ExcessFieldBand,
  ExcessFieldConfig,
  ExcessGroup,
} from "./types";

export function isExcessFieldVisible(
  field: ExcessFieldConfig,
  opts: ExcessBandContext & {
    liabilityLimitBand?: unknown;
  },
): boolean {
  if (field.group === "contractWorks" && field.band) {
    const perilsBand = resolvePerilsStorageBand(opts.contractWorksSumInsured);
    if (perilsBand != null) {
      return field.band === perilsBand;
    }
    // Unset contract works: show up-to-$2M Major / Minor row until value is known.
    return field.band === "upTo2m";
  }

  if (field.group === "legalLiability") {
    if (!isLegalLiabilityInsured(opts.liabilityLimitBand)) {
      return false;
    }
    if (field.key === "excessWorkerToWorker") {
      return true;
    }
    const selectedLimit = resolveLiabilityLimitMillions(
      opts.liabilityLimitBand,
    );
    if (
      field.liabilityLimitMillions &&
      selectedLimit !== field.liabilityLimitMillions
    ) {
      return false;
    }
  }

  if (!field.band) return true;

  const band = resolveContractValueBand(opts.contractWorksSumInsured);
  if (!band) return false;
  return field.band === band;
}

export function visibleExcessFields(opts: {
  contractWorksSumInsured?: unknown;
  liabilityLimitBand?: unknown;
  group?: ExcessGroup;
}): ExcessFieldConfig[] {
  return EXCESS_FIELDS.filter((field) => {
    if (opts.group && field.group !== opts.group) return false;
    return isExcessFieldVisible(field, opts);
  });
}

/** Group fields in order, inserting band headings when `band` changes. */
export function groupExcessFieldsByBand(
  fields: ExcessFieldConfig[],
): ExcessFieldBand[] {
  const groups: ExcessFieldBand[] = [];

  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (last && last.band === field.band) {
      last.fields.push(field);
    } else {
      groups.push({ band: field.band, fields: [field] });
    }
  }

  return groups;
}
