import priceFilesData from "~/data/price-files.json";
import type {
  ResolvedEsl,
  ResolvedPlant,
  ResolvedPriceFile,
  ResolvedStampDuty,
  ResolvedTerror,
} from "~/server/pricing/types";

type PriceFilesData = {
  priceFiles: Array<{
    priceFileId: number;
    dateStart: string;
    published: boolean;
    bands: Array<{
      coverTypeId: number;
      lowerTO: number;
      upperTO: number | null;
      cwRate: number;
      cwMinPrem: number;
      tenMilRate: number;
      tenMilMinPrem: number;
      twentyMilRate: number;
      twentyMilMinPrem: number;
    }>;
  }>;
  stampDuty: Array<{
    priceFileStampDutyId: number;
    dateStart: string;
    rates: Array<{ stateCode: string; rate: number }>;
  }>;
  esl: Array<{
    priceFileEslId: number;
    dateStart: string;
    rates: Array<{ stateCode: string; constructionRate: number; plantRate: number }>;
  }>;
  terror: Array<{
    priceFileTerrorId: number;
    dateStart: string;
    tiers: Array<{ tier: string; rate: number; postcodes: string[] }>;
  }>;
  plant: Array<{
    priceFilePlantId: number;
    dateStart: string;
    rate: number;
    plantMinValue: number;
    plantMaxValue: number;
  }>;
};

const data = priceFilesData as PriceFilesData;

function pickLatest<T extends { dateStart: string; published?: boolean }>(
  items: T[],
  date: string,
): T | null {
  return (
    items
      .filter((item) => item.dateStart <= date && (item.published ?? true))
      .sort((a, b) => b.dateStart.localeCompare(a.dateStart))[0] ?? null
  );
}

export function resolvePriceFile(
  coverTypeId: number,
  turnover: number,
  date: string,
): ResolvedPriceFile | null {
  const file = pickLatest(data.priceFiles, date);
  if (!file) return null;

  const band = file.bands.find(
    (item) =>
      item.coverTypeId === coverTypeId &&
      turnover >= item.lowerTO &&
      (item.upperTO == null || turnover <= item.upperTO),
  );
  if (!band) return null;

  return {
    priceFileId: file.priceFileId,
    coverTypeId: band.coverTypeId,
    lowerTurnover: band.lowerTO,
    upperTurnover: band.upperTO,
    cwRate: band.cwRate,
    cwMinPrem: band.cwMinPrem,
    tenMilRate: band.tenMilRate,
    tenMilMinPrem: band.tenMilMinPrem,
    twentyMilRate: band.twentyMilRate,
    twentyMilMinPrem: band.twentyMilMinPrem,
    dateApplied: file.dateStart,
  };
}

export function resolveStampDuty(
  stateCode: string,
  date: string,
): ResolvedStampDuty | null {
  const file = pickLatest(data.stampDuty, date);
  if (!file) return null;
  const rate = file.rates.find((item) => item.stateCode === stateCode);
  if (!rate) return null;
  return {
    priceFileStampDutyId: file.priceFileStampDutyId,
    rate: rate.rate,
    dateApplied: file.dateStart,
  };
}

export function resolveEsl(stateCode: string, date: string): ResolvedEsl | null {
  const file = pickLatest(data.esl, date);
  if (!file) return null;
  const rate = file.rates.find((item) => item.stateCode === stateCode);
  if (!rate) return null;
  return {
    priceFileEslId: file.priceFileEslId,
    constructionRate: rate.constructionRate,
    plantRate: rate.plantRate,
    dateApplied: file.dateStart,
  };
}

export function resolveTerrorism(
  postcode: string,
  stateCode: string,
  date: string,
): ResolvedTerror | null {
  const file = pickLatest(data.terror, date);
  if (!file) return null;

  for (const tier of file.tiers) {
    if (tier.postcodes.includes(postcode)) {
      return { rate: tier.rate, tier: tier.tier };
    }
  }

  return { rate: 0.01, tier: `${stateCode}-default` };
}

export function resolvePlantRate(date: string): ResolvedPlant | null {
  const file = pickLatest(data.plant, date);
  if (!file) return null;
  return {
    priceFilePlantId: file.priceFilePlantId,
    rate: file.rate,
    plantMinValue: file.plantMinValue,
    plantMaxValue: file.plantMaxValue,
    dateApplied: file.dateStart,
  };
}
