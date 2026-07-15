export type Section2Value = 1 | 2 | 3;

export type PriceFileBand = {
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

export type ResolvedPriceFile = {
  priceFileId: number;
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
  priceFileStampDutyId: number;
  rate: number;
  dateApplied: string;
};

export type ResolvedEsl = {
  priceFileEslId: number;
  constructionRate: number;
  plantRate: number;
  dateApplied: string;
};

export type ResolvedTerror = {
  rate: number;
  tier: string;
};

export type ResolvedPlant = {
  priceFilePlantId: number;
  rate: number;
  plantMinValue: number;
  plantMaxValue: number;
  dateApplied: string;
};

export type RatingSnapshot = {
  priceFileId: number;
  stampDutyId: number;
  eslId: number;
  plantRate: number;
  eslRate: number;
  eslPlantRate: number;
  sdRateSection1: number;
  sdRateSection2: number;
  section1Rate: number;
  section2Rate: number;
  section1MinPrem: number;
  section2MinPrem: number;
  plantMinPrem: number;
  plantMaxPrem: number;
  terrorismRate: number;
  terrorismTier: string;
  isTerrorismRateExist: boolean;
};

export type CarCalculatorResult = {
  premium: import("~/lib/db/types").PremiumBreakdown;
  rating: RatingSnapshot;
  referralReasons: string[];
};
