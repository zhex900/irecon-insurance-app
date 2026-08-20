/**
 * Shared shape for CAR price catalogue payloads
 * (MSSQL export → Postgres seed / migrate).
 */

export type TerrorPostcode =
  | string
  | {
      postcode: string;
      stateCode?: string;
    };

export type PricesPayload = {
  meta?: {
    source: string;
    exportedAt: string;
    database: string;
  };
  prices: Array<{
    priceId: number;
    dateStart: string;
    published?: boolean;
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
    priceStampDutyId: number;
    dateStart: string;
    published?: boolean;
    rates: Array<{ stateCode: string; rate: number; section?: number | null }>;
  }>;
  esl: Array<{
    priceEslId: number;
    dateStart: string;
    published?: boolean;
    rates: Array<{
      stateCode: string;
      constructionRate: number;
      plantRate: number;
    }>;
  }>;
  terror: Array<{
    priceTerrorismId: number;
    dateStart: string;
    published?: boolean;
    tiers: Array<{
      tier: string;
      rate: number;
      postcodes: TerrorPostcode[];
    }>;
  }>;
  plant: Array<{
    pricePlantId: number;
    dateStart: string;
    published?: boolean;
    rate: number;
    plantMinValue: number;
    plantMaxValue: number;
  }>;
  brokerFees?: Array<{
    dateStart: string;
    published?: boolean;
    lines: Array<{
      sortOrder: number;
      name: string;
      fee: number;
      feeGst: number;
    }>;
  }>;
};

export type PricesSeedCounts = {
  prices: number;
  stampDuty: number;
  esl: number;
  terror: number;
  terrorPostcodes: number;
  plant: number;
  feeSchedules: number;
  feeLines: number;
};
