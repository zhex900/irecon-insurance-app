export type LiabilityLimitBand = 1 | 2 | 3;

export type PriceBand = {
  coverTypeId: number;
  lowerTO: number;
  upperTO: number | null;
  cwRate: number;
  cwMinPrem: number;
  tenMilRate: number;
  tenMilMinPrem: number;
  twentyMilRate: number;
  twentyMilMinPrem: number;
};

export type ResolvedPrice = {
  priceId: number;
  coverTypeId: number;
  lowerTurnover: number;
  upperTurnover: number | null;
  cwRate: number | null;
  cwMinPrem: number;
  tenMilRate: number | null;
  tenMilMinPrem: number;
  twentyMilRate: number | null;
  twentyMilMinPrem: number;
  dateApplied: string;
};

export type ResolvedStampDuty = {
  priceStampDutyId: number;
  rate: number;
  dateApplied: string;
};

export type ResolvedEsl = {
  priceEslId: number;
  constructionRate: number;
  plantRate: number;
  dateApplied: string;
};

export type ResolvedTerror = {
  rate: number;
  tier: string;
};

export type ResolvedPlant = {
  pricePlantId: number;
  rate: number;
  plantMinValue: number;
  plantMaxValue: number;
  dateApplied: string;
};

export type RatingSnapshot = {
  priceId: number;
  stampDutyId: number;
  eslId: number;
  plantRate: number;
  eslRate: number;
  plantEslRate: number;
  contractWorksStampDutyRate: number;
  liabilityStampDutyRate: number;
  contractWorksAppliedRate: number;
  liabilityAppliedRate: number;
  contractWorksMinPremium: number;
  liabilityMinPremium: number;
  plantValueMin: number;
  plantValueMax: number;
  terrorismRate: number;
  terrorismTier: string;
  isTerrorismRateExist: boolean;
};

export type CarCalculatorResult = {
  premium: import("~/lib/db/types").PremiumBreakdown;
  rating: RatingSnapshot;
  referralReasons: string[];
};
