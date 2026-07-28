import type {
  AdjustmentBreakdown,
  AdjustmentSectionRow,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";

const GST_RATE = 0.1;

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
  const originalSection1 = buildSectionRow({
    base: premium.contractWorksBasePremium,
    terror: premium.contractWorksTerrorismPremium,
    eslRate: rating.eslRate,
    sdRate: rating.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const originalSection2 = buildSectionRow({
    base: premium.liabilityBasePremium,
    terror: 0,
    eslRate: rating.eslRate,
    sdRate: rating.liabilityStampDutyRate,
    stampDutyExempt,
    isSection2: true,
  });

  const adjustedSection1Base = Math.max(
    adjustmentTurnover * rating.contractWorksAppliedRate,
    rating.contractWorksMinPremium,
  );
  const adjustedSection2Base = Math.max(
    adjustmentTurnover * rating.liabilityAppliedRate,
    rating.liabilityMinPremium,
  );

  const adjustmentSection1 = buildSectionRow({
    base: adjustedSection1Base,
    terror: adjustedSection1Base * rating.terrorismRate,
    eslRate: rating.eslRate,
    sdRate: rating.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const adjustmentSection2 = buildSectionRow({
    base: adjustedSection2Base,
    terror: 0,
    eslRate: rating.eslRate,
    sdRate: rating.liabilityStampDutyRate,
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
    terror: deltaSection1Base * rating.terrorismRate,
    eslRate: rating.eslRate,
    sdRate: rating.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const deltaSection2 = buildSectionRow({
    base: deltaSection2Base,
    terror: 0,
    eslRate: rating.eslRate,
    sdRate: rating.liabilityStampDutyRate,
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
  const esl = isSection2 ? 0 : (base + terror) * eslRate;
  const gst = (base + terror + esl) * GST_RATE;
  const sd =
    isSection2 && stampDutyExempt ? 0 : (base + terror + esl + gst) * sdRate;
  const totalPremium = base + terror + esl + gst + sd;

  return {
    trueBasePremium: round(base),
    terrorismPremium: round(terror),
    esl: round(esl),
    gst: round(gst),
    sd: round(sd),
    totalPremium: round(totalPremium),
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
