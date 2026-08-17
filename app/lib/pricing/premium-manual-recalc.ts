/**
 * Client-side premium breakdown adjustment for Premium Breakdown click-to-edit.
 *
 * Corrected vs legacy CalculatePremium quirks — see
 * docs/pricing/legacy-vs-rebuild-premium-manual.md
 *
 * @see docs/pricing/car-premium-formulas.md §6
 */
import { GST_RATE } from "~/constants";
import type { PremiumBreakdown, RatingSnapshot } from "~/lib/db/types";
import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";

const TAX_LINE_KEYS = new Set<keyof PremiumBreakdown>([
  "contractWorksESL",
  "liabilityESL",
  "contractWorksStampDuty",
  "liabilityStampDuty",
  "contractWorksGST",
  "liabilityGST",
]);

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function asRate(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type ManualPremiumSessionRates = {
  /** Effective terrorism rate for subsequent True Base / ES / DH / plant edits. */
  terrorismRate: number;
  /** Plant ESL rate (from rating or back-derived after Plant ESL edit). */
  plantEslRate: number;
};

export type ManualPremiumEditResult = {
  premium: PremiumBreakdown;
  /** @deprecated Always false — tax lines no longer permanently freeze auto-recalc. */
  manualTaxOverride: boolean;
  sessionRates: ManualPremiumSessionRates;
};

function resolveSessionRates(
  premium: PremiumBreakdown,
  rating: RatingSnapshot | undefined,
  sessionRates: ManualPremiumSessionRates | undefined,
): ManualPremiumSessionRates {
  const base = asRate(premium.contractWorksBasePremium);
  const dh = asRate(premium.contractWorksDisplayHomesPremium);
  const es = asRate(premium.contractWorksExistingStructurePremium);
  const terror = asRate(premium.contractWorksTerrorismPremium);
  const plant = asRate(premium.contractWorksPlantPremium);
  const plantEsl = asRate(premium.contractWorksPlantESL);

  let terrorismRate = asRate(sessionRates?.terrorismRate);
  if (terrorismRate <= 0) terrorismRate = asRate(rating?.terrorismRate);
  if (terrorismRate <= 0 && terror > 0) {
    // Prefer full stack when ES/DH present (levy is usually folded).
    const denom = base + es + dh;
    if (denom > 0) terrorismRate = terror / denom;
  }

  let plantEslRate = asRate(sessionRates?.plantEslRate);
  if (plantEslRate <= 0) plantEslRate = asRate(rating?.plantEslRate);
  if (plantEslRate <= 0) plantEslRate = asRate(rating?.eslRate);
  if (plantEslRate <= 0 && plant > 0 && plantEsl > 0) {
    plantEslRate = plantEsl / plant;
  }

  return { terrorismRate, plantEslRate };
}

/**
 * Apply a single manual premium-line edit and recalculate dependents.
 */
export function applyManualPremiumEdit({
  premium,
  rating,
  key,
  value,
  sessionRates: sessionRatesIn,
}: {
  premium: PremiumBreakdown;
  rating: RatingSnapshot | undefined;
  key: keyof PremiumBreakdown;
  value: number;
  /** Ignored — kept for call-site compat. Tax freeze (legacy Quirk 4) removed. */
  manualTaxOverride?: boolean;
  sessionRates?: ManualPremiumSessionRates;
}): ManualPremiumEditResult {
  const eslRate = asRate(rating?.eslRate);
  const sd1 = asRate(rating?.contractWorksStampDutyRate);
  const sd2 = asRate(rating?.liabilityStampDutyRate);
  const cwMin = asRate(rating?.contractWorksMinPremium);
  const liabMin = asRate(rating?.liabilityMinPremium);

  const sessionRates = resolveSessionRates(premium, rating, sessionRatesIn);
  let τ = sessionRates.terrorismRate;
  let plantEslRate = sessionRates.plantEslRate;

  // Tax line edit: keep the typed value; refresh only dependent tax lines.
  // Does NOT freeze future auto-recalc (fixes legacy Quirk 4).
  if (TAX_LINE_KEYS.has(key)) {
    const next: PremiumBreakdown = { ...premium, [key]: value };
    if (
      key === "contractWorksESL" ||
      key === "contractWorksStampDuty" ||
      key === "contractWorksGST"
    ) {
      applyContractWorksTaxDependents(next, {
        eslRate,
        sd1,
        preserveEsl: key === "contractWorksESL",
        preserveSd: key === "contractWorksStampDuty",
        preserveGst: key === "contractWorksGST",
      });
    }
    if (
      key === "liabilityESL" ||
      key === "liabilityStampDuty" ||
      key === "liabilityGST"
    ) {
      const liabBase = asRate(next.liabilityBasePremium);
      const liabEsl = asRate(next.liabilityESL);
      if (key !== "liabilityGST") {
        next.liabilityGST = roundMoney((liabBase + liabEsl) * GST_RATE);
      }
      if (key !== "liabilityStampDuty") {
        next.liabilityStampDuty = roundMoney(
          (liabBase + liabEsl + next.liabilityGST) * sd2,
        );
      }
    }
    return {
      premium: rollupPremiumTotals(next),
      manualTaxOverride: false,
      sessionRates: { terrorismRate: τ, plantEslRate },
    };
  }

  const next: PremiumBreakdown = { ...premium, [key]: value };
  const prevPlantTerror = asRate(premium.contractWorksPlantTerrorismPremium);

  // True Base may only increase (or stay). Floor at current value and rating min.
  if (key === "contractWorksBasePremium") {
    const floor = Math.max(asRate(premium.contractWorksBasePremium), cwMin);
    next.contractWorksBasePremium = roundMoney(Math.max(value, floor));
  }
  if (key === "liabilityBasePremium") {
    const floor = Math.max(asRate(premium.liabilityBasePremium), liabMin);
    next.liabilityBasePremium = roundMoney(Math.max(value, floor));
  }

  const base = asRate(next.contractWorksBasePremium);
  const dh = asRate(next.contractWorksDisplayHomesPremium);
  const es = asRate(next.contractWorksExistingStructurePremium);
  const plant = asRate(next.contractWorksPlantPremium);

  // True Base / ES / DH: levy = (base + ES + DH) × τ (Quirk 1 fixed).
  if (
    key === "contractWorksBasePremium" ||
    key === "contractWorksDisplayHomesPremium" ||
    key === "contractWorksExistingStructurePremium"
  ) {
    next.contractWorksTerrorismPremium = roundMoney(base * τ + es * τ + dh * τ);
  }

  // Terrorism Levy: typed value sticks (Quirk 2 fixed). τ′ = entered/base for
  // plant terror + session; Plant ESL unchanged.
  if (key === "contractWorksTerrorismPremium" && base > 0) {
    τ = value / base;
    next.contractWorksTerrorismPremium = roundMoney(value);
    next.contractWorksPlantTerrorismPremium =
      plant > 0 ? roundMoney(plant * τ) : 0;
  }

  if (key === "contractWorksPlantPremium") {
    next.contractWorksPlantESL =
      plant > 0 ? roundMoney((plant + prevPlantTerror) * plantEslRate) : 0;
    next.contractWorksPlantTerrorismPremium =
      plant > 0 ? roundMoney(plant * τ) : 0;
  }

  // Typed plant terrorism levy sticks; ESL uses (plant + entered) × plantEslRate.
  if (key === "contractWorksPlantTerrorismPremium") {
    next.contractWorksPlantTerrorismPremium = roundMoney(value);
    next.contractWorksPlantESL =
      plant > 0 ? roundMoney((plant + value) * plantEslRate) : 0;
  }

  if (key === "contractWorksPlantESL" && plant > 0) {
    plantEslRate = value / plant;
  }

  // Driver edits always refresh ESL / GST / SD (no permanent tax freeze).
  applyContractWorksTaxDependents(next, {
    eslRate,
    sd1,
    preserveEsl: false,
    preserveSd: false,
    preserveGst: false,
  });

  if (key === "liabilityBasePremium") {
    const liabBase = asRate(next.liabilityBasePremium);
    const liabEsl = asRate(next.liabilityESL);
    next.liabilityGST = roundMoney((liabBase + liabEsl) * GST_RATE);
    next.liabilityStampDuty = roundMoney(
      (liabBase + liabEsl + next.liabilityGST) * sd2,
    );
  }

  return {
    premium: rollupPremiumTotals(next),
    manualTaxOverride: false,
    sessionRates: { terrorismRate: τ, plantEslRate },
  };
}

function applyContractWorksTaxDependents(
  next: PremiumBreakdown,
  opts: {
    eslRate: number;
    sd1: number;
    preserveEsl: boolean;
    preserveSd: boolean;
    preserveGst: boolean;
  },
) {
  const base = asRate(next.contractWorksBasePremium);
  const terror = asRate(next.contractWorksTerrorismPremium);
  const dh = asRate(next.contractWorksDisplayHomesPremium);
  const es = asRate(next.contractWorksExistingStructurePremium);
  const plant = asRate(next.contractWorksPlantPremium);
  const plantTerror = asRate(next.contractWorksPlantTerrorismPremium);
  const plantEsl = asRate(next.contractWorksPlantESL);
  const { eslRate: e, sd1, preserveEsl, preserveSd, preserveGst } = opts;

  if (!preserveEsl) {
    next.contractWorksESL = roundMoney((base + terror + es + dh) * e);
  }

  if (!preserveGst) {
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
  }

  if (!preserveSd) {
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
        sd1,
    );
  }
}
