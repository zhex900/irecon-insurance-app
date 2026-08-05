import type {
  AdjustmentBreakdown,
  AdjustmentSectionRow,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";
import { GST_RATE } from "~/lib/pricing/constants";

/**
 * End-of-term adjustment (legacy CARAdjust.aspx).
 *
 * Uses **frozen rates back-calculated from stored premium amounts** (§9), not the
 * lookup rates kept on `rating` for live premium recalc. Legacy save overwrote
 * certificate ESL/terror/SD rates that way (ES/plant absorbed into the rate);
 * rebuild keeps lookup rates on the policy and derives the same effective rates here.
 */
export function calculateCarAdjustment({
  originalTurnover,
  adjustmentTurnover,
  stampDutyExempt,
  premium,
  rating,
}: {
  originalTurnover: number;
  adjustmentTurnover: number;
  stampDutyExempt: boolean;
  premium: PremiumBreakdown;
  rating: RatingSnapshot;
}): AdjustmentBreakdown {
  const rates = resolveAdjustmentRates(premium, rating, originalTurnover);

  const originalSection1 = buildSectionRow({
    base: premium.contractWorksBasePremium,
    terror: premium.contractWorksTerrorismPremium,
    eslRate: rates.eslRate,
    sdRate: rates.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const originalSection2 = buildSectionRow({
    base: premium.liabilityBasePremium,
    terror: 0,
    eslRate: rates.eslRate,
    sdRate: rates.liabilityStampDutyRate,
    stampDutyExempt,
    isSection2: true,
  });

  // Round bases to cents before tax lines (matches Excel ROUND on each step).
  const adjustedSection1Base = round(
    Math.max(
      adjustmentTurnover * rates.contractWorksAppliedRate,
      rates.contractWorksMinPremium,
    ),
  );
  const adjustedSection2Base = round(
    Math.max(
      adjustmentTurnover * rates.liabilityAppliedRate,
      rates.liabilityMinPremium,
    ),
  );

  const adjustmentSection1 = buildSectionRow({
    base: adjustedSection1Base,
    terror: adjustedSection1Base * rates.terrorismRate,
    eslRate: rates.eslRate,
    sdRate: rates.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const adjustmentSection2 = buildSectionRow({
    base: adjustedSection2Base,
    terror: 0,
    eslRate: rates.eslRate,
    sdRate: rates.liabilityStampDutyRate,
    stampDutyExempt,
    isSection2: true,
  });

  const deltaSection1Base = calculateBaseDelta(
    originalSection1.trueBasePremium,
    adjustmentSection1.trueBasePremium,
  );
  const deltaSection2Base = calculateBaseDelta(
    originalSection2.trueBasePremium,
    adjustmentSection2.trueBasePremium,
  );

  const deltaSection1 = buildSectionRow({
    base: deltaSection1Base,
    terror: deltaSection1Base * rates.terrorismRate,
    eslRate: rates.eslRate,
    sdRate: rates.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const deltaSection2 = buildSectionRow({
    base: deltaSection2Base,
    terror: 0,
    eslRate: rates.eslRate,
    sdRate: rates.liabilityStampDutyRate,
    stampDutyExempt,
    isSection2: true,
  });

  return {
    originalTurnover,
    adjustmentTurnover,
    stampDutyExempt,
    original: {
      section1: originalSection1,
      section2: originalSection2,
      total: combineRows(originalSection1, originalSection2),
    },
    adjustment: {
      section1: adjustmentSection1,
      section2: adjustmentSection2,
      total: combineRows(adjustmentSection1, adjustmentSection2),
    },
    delta: {
      section1: deltaSection1,
      section2: deltaSection2,
      total: combineRows(deltaSection1, deltaSection2),
    },
  };
}

export function validateAdjustmentFinish(
  breakdown: AdjustmentBreakdown,
): string | null {
  const originalCombined = breakdown.original.total.totalPremium;
  const deltaCombined = breakdown.delta.total.totalPremium;
  const minimumReturn = originalCombined * 0.75;

  if (deltaCombined < 0 && Math.abs(deltaCombined) > minimumReturn) {
    return "The return premium is more than 75% of the original premium. Unable to continue.";
  }

  return null;
}

/** @internal exported for unit tests */
export function resolveAdjustmentRates(
  premium: PremiumBreakdown,
  rating: RatingSnapshot,
  originalTurnover: number,
) {
  const s1Base = premium.contractWorksBasePremium;
  const s1Terror = premium.contractWorksTerrorismPremium;
  const s1Plant = premium.contractWorksPlantPremium;
  const s1PlantTerror = premium.contractWorksPlantTerrorismPremium;
  const s1PlantEsl = premium.contractWorksPlantESL;
  const s1Esl = premium.contractWorksESL;
  const s1Gst = premium.contractWorksGST;
  const s1Sd = premium.contractWorksStampDuty;
  const s2Base = premium.liabilityBasePremium;
  const s2Esl = premium.liabilityESL;
  const s2Gst = premium.liabilityGST;
  const s2Sd = premium.liabilityStampDuty;

  const terrorDenom = s1Base;
  const eslDenom = s1Base + s1Terror;
  // Legacy SDRateSection1 denom excludes ES/DH (CARNewPolicy.aspx.cs ~502–503).
  const sd1Denom =
    s1Base + s1Terror + s1Plant + s1PlantTerror + s1PlantEsl + s1Esl + s1Gst;
  const sd2Denom = s2Base + s2Esl + s2Gst;

  return {
    contractWorksAppliedRate: resolveAppliedRate({
      beforeBase: premium.contractWorksCalculatedBasePremium,
      trueBase: s1Base,
      turnover: originalTurnover,
      fallback: rating.contractWorksAppliedRate,
    }),
    liabilityAppliedRate: resolveAppliedRate({
      beforeBase: premium.liabilityCalculatedBasePremium,
      trueBase: s2Base,
      turnover: originalTurnover,
      fallback: rating.liabilityAppliedRate,
    }),
    contractWorksMinPremium: rating.contractWorksMinPremium,
    liabilityMinPremium: rating.liabilityMinPremium,
    // 0 is a valid frozen rate (e.g. no terrorism) — only fall back when denom missing.
    terrorismRate: rateFromPremium(s1Terror, terrorDenom, rating.terrorismRate),
    eslRate: rateFromPremium(s1Esl, eslDenom, rating.eslRate),
    contractWorksStampDutyRate: rateFromPremium(
      s1Sd,
      sd1Denom,
      rating.contractWorksStampDutyRate,
    ),
    liabilityStampDutyRate: rateFromPremium(
      s2Sd,
      sd2Denom,
      rating.liabilityStampDutyRate,
    ),
  };
}

/**
 * Legacy Section1Rate / Section2Rate on save:
 * (BeforeBase < TrueBase) ? BeforeBase/Turnover : TrueBase/Turnover
 */
function resolveAppliedRate({
  beforeBase,
  trueBase,
  turnover,
  fallback,
}: {
  beforeBase: number;
  trueBase: number;
  turnover: number;
  fallback: number;
}) {
  if (!(turnover > 0)) return fallback;
  const numerator = beforeBase < trueBase ? beforeBase : trueBase;
  return roundRate(numerator / turnover);
}

function rateFromPremium(
  numerator: number,
  denominator: number,
  fallback: number,
) {
  if (!(denominator > 0) || !Number.isFinite(numerator)) return fallback;
  return roundRate(numerator / denominator);
}

/** Legacy Math.Round(..., 6, MidpointRounding.AwayFromZero) for positive rates. */
function roundRate(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

function buildSectionRow({
  base,
  terror,
  eslRate,
  sdRate,
  stampDutyExempt,
  isSection2,
}: {
  base: number;
  terror: number;
  eslRate: number;
  sdRate: number;
  stampDutyExempt: boolean;
  isSection2: boolean;
}): AdjustmentSectionRow {
  // Round each line to cents before feeding the next tax (Excel ROUND chain).
  // Using unrounded ESL/GST in the SD base caused 1¢ drift vs the spreadsheet.
  const trueBasePremium = round(base);
  const terrorismPremium = round(terror);
  const esl = isSection2
    ? 0
    : round((trueBasePremium + terrorismPremium) * eslRate);
  const gst = round((trueBasePremium + terrorismPremium + esl) * GST_RATE);
  const sd =
    isSection2 && stampDutyExempt
      ? 0
      : round((trueBasePremium + terrorismPremium + esl + gst) * sdRate);

  return {
    trueBasePremium,
    terrorismPremium,
    esl,
    gst,
    sd,
    // Sum rounded lines (not round of the unrounded sum) so totals match the grid.
    totalPremium: round(trueBasePremium + terrorismPremium + esl + gst + sd),
  };
}

function calculateBaseDelta(originalBase: number, adjustedBase: number) {
  if (
    adjustedBase < originalBase &&
    originalBase > 0 &&
    (originalBase - adjustedBase) / originalBase > 0.25
  ) {
    return round(originalBase * 0.25 * -1);
  }
  return round(adjustedBase - originalBase);
}

function combineRows(
  section1: AdjustmentSectionRow,
  section2: AdjustmentSectionRow,
): AdjustmentSectionRow {
  return {
    trueBasePremium: round(section1.trueBasePremium + section2.trueBasePremium),
    terrorismPremium: round(
      section1.terrorismPremium + section2.terrorismPremium,
    ),
    esl: round(section1.esl + section2.esl),
    gst: round(section1.gst + section2.gst),
    sd: round(section1.sd + section2.sd),
    totalPremium: round(section1.totalPremium + section2.totalPremium),
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
