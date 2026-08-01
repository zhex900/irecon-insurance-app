/**
 * Client-side premium breakdown adjustment (legacy CARNewPolicy / CARViewPolicy
 * `CalculatePremium`). Used when a broker manually edits lines on the Premium
 * Breakdown — not the full server `calculateCarPremium` from turnover.
 *
 * @see docs/pricing/car-premium-formulas.md §6
 * @see _archive/specs/CAR_PRICING_FORMULAS.md §6
 */
import type { PremiumBreakdown, RatingSnapshot } from "~/lib/db/types";
import { rollupPremiumTotals } from "~/lib/premium-totals";

const GST_RATE = 0.1;

/** Editing these locks ESL / stamp duty from further auto-recalc (legacy ManualTaxOverride). */
const TAX_LOCK_KEYS = new Set<keyof PremiumBreakdown>([
  "contractWorksESL",
  "liabilityESL",
  "contractWorksStampDuty",
  "liabilityStampDuty",
  "contractWorksGST",
  "liabilityGST",
]);

const SECTION1_DRIVER_KEYS = new Set<keyof PremiumBreakdown>([
  "contractWorksBasePremium",
  "contractWorksTerrorismPremium",
  "contractWorksDisplayHomesPremium",
  "contractWorksExistingStructurePremium",
  "contractWorksPlantPremium",
  "contractWorksPlantTerrorismPremium",
  "contractWorksPlantESL",
]);

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export type ManualPremiumEditResult = {
  premium: PremiumBreakdown;
  manualTaxOverride: boolean;
};

/**
 * Apply a single manual premium-line edit and recalculate dependent levies /
 * taxes / totals using frozen rates from the rating snapshot.
 */
export function applyManualPremiumEdit({
  premium,
  rating,
  key,
  value,
  manualTaxOverride,
}: {
  premium: PremiumBreakdown;
  rating: RatingSnapshot | undefined;
  key: keyof PremiumBreakdown;
  value: number;
  manualTaxOverride: boolean;
}): ManualPremiumEditResult {
  if (!rating) {
    return {
      premium: rollupPremiumTotals({ ...premium, [key]: value }),
      manualTaxOverride,
    };
  }

  if (TAX_LOCK_KEYS.has(key)) {
    return {
      premium: rollupPremiumTotals({ ...premium, [key]: value }),
      manualTaxOverride: true,
    };
  }

  const next: PremiumBreakdown = { ...premium, [key]: value };
  const τ = rating.terrorismRate;
  const e = rating.eslRate;

  if (key === "contractWorksBasePremium") {
    next.contractWorksBasePremium = roundMoney(
      Math.max(value, rating.contractWorksMinPremium),
    );
  }
  if (key === "liabilityBasePremium") {
    next.liabilityBasePremium = roundMoney(
      Math.max(value, rating.liabilityMinPremium),
    );
  }

  const base = next.contractWorksBasePremium;
  const dh = next.contractWorksDisplayHomesPremium ?? 0;
  const es = next.contractWorksExistingStructurePremium ?? 0;
  const plant = next.contractWorksPlantPremium;

  // Terrorism display = base×τ + ES×τ + DH×τ (legacy client folds ES/DH terror in).
  if (
    key === "contractWorksBasePremium" ||
    key === "contractWorksDisplayHomesPremium" ||
    key === "contractWorksExistingStructurePremium"
  ) {
    next.contractWorksTerrorismPremium = roundMoney(base * τ + es * τ + dh * τ);
  }

  if (key === "contractWorksPlantPremium") {
    next.contractWorksPlantTerrorismPremium =
      plant > 0 ? roundMoney(plant * τ) : 0;
    next.contractWorksPlantESL =
      plant > 0
        ? roundMoney((plant + next.contractWorksPlantTerrorismPremium) * e)
        : 0;
  } else if (
    key === "contractWorksPlantTerrorismPremium" &&
    !manualTaxOverride
  ) {
    next.contractWorksPlantESL =
      plant > 0
        ? roundMoney((plant + next.contractWorksPlantTerrorismPremium) * e)
        : 0;
  }

  if (SECTION1_DRIVER_KEYS.has(key) || key === "liabilityBasePremium") {
    recomputeTaxes(next, rating, manualTaxOverride, {
      section1: SECTION1_DRIVER_KEYS.has(key),
      section2: key === "liabilityBasePremium",
    });
  }

  return {
    premium: rollupPremiumTotals(next),
    manualTaxOverride,
  };
}

function recomputeTaxes(
  next: PremiumBreakdown,
  rating: RatingSnapshot,
  manualTaxOverride: boolean,
  sections: { section1: boolean; section2: boolean },
) {
  const base = next.contractWorksBasePremium;
  const terror = next.contractWorksTerrorismPremium;
  const dh = next.contractWorksDisplayHomesPremium ?? 0;
  const es = next.contractWorksExistingStructurePremium ?? 0;
  const plant = next.contractWorksPlantPremium;
  const plantTerror = next.contractWorksPlantTerrorismPremium;
  const plantEsl = next.contractWorksPlantESL;
  const e = rating.eslRate;

  if (sections.section1) {
    // ESL = (Base + displayedTerror + ES + DH) × e
    // displayedTerror already includes ES_τ + DH_τ when derived from base.
    if (!manualTaxOverride) {
      next.contractWorksESL = roundMoney((base + terror + es + dh) * e);
    }

    // GST always recalculated (legacy).
    next.contractWorksGST = roundMoney(
      (base +
        terror +
        es +
        dh +
        plant +
        plantTerror +
        plantEsl +
        next.contractWorksESL) *
        GST_RATE,
    );

    if (!manualTaxOverride) {
      next.contractWorksStampDuty = roundMoney(
        (base +
          terror +
          es +
          dh +
          plant +
          plantTerror +
          plantEsl +
          next.contractWorksESL +
          next.contractWorksGST) *
          rating.contractWorksStampDutyRate,
      );
    }
  }

  if (sections.section2) {
    const liabBase = next.liabilityBasePremium;
    const liabEsl = next.liabilityESL;
    next.liabilityGST = roundMoney((liabBase + liabEsl) * GST_RATE);
    if (!manualTaxOverride) {
      next.liabilityStampDuty = roundMoney(
        (liabBase + liabEsl + next.liabilityGST) *
          rating.liabilityStampDutyRate,
      );
    }
  }
}
