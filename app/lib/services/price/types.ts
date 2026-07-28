export type PriceCatalogueKind =
  "car" | "stamp" | "esl" | "plant" | "terror" | "fees";

export type CarBandInput = {
  coverTypeId: number;
  turnoverMin: number;
  turnoverMax: number | null;
  contractWorksRate: number;
  contractWorksMinPremium: number;
  liability10mRate: number;
  liability10mMinPremium: number;
  liability20mRate: number;
  liability20mMinPremium: number;
};

export type CarScheduleInput = {
  dateStart: string;
  published: boolean;
  bands: CarBandInput[];
};

export type StampScheduleInput = {
  dateStart: string;
  published: boolean;
  rates: Array<{ stateCode: string; rate: number }>;
};

export type EslScheduleInput = {
  dateStart: string;
  published: boolean;
  rates: Array<{
    stateCode: string;
    constructionRate: number;
    plantRate: number;
  }>;
};

export type PlantRateInput = {
  dateStart: string;
  published: boolean;
  rate: number;
  plantMinValue: number;
  plantMaxValue: number;
};

export type TerrorScheduleInput = {
  dateStart: string;
  published: boolean;
  tiers: Array<{ tier: string; rate: number }>;
};

export type FeeScheduleInput = {
  dateStart: string;
  published: boolean;
  lines: Array<{
    sortOrder: number;
    name: string;
    fee: number;
    feeGst: number;
  }>;
};

export type PriceCatalogueSnapshot = {
  coverTypes: Array<{ coverTypeId: number; name: string }>;
  states: Array<{ stateId: number; code: string; name: string }>;
  car: Array<{
    priceId: number;
    dateStart: string;
    published: boolean;
    createdBy: string;
    bands: Array<{
      coverTypeId: number;
      coverTypeName: string;
      turnoverMin: number;
      turnoverMax: number | null;
      contractWorksRate: number;
      contractWorksMinPremium: number;
      liability10mRate: number;
      liability10mMinPremium: number;
      liability20mRate: number;
      liability20mMinPremium: number;
    }>;
  }>;
  stampDuty: Array<{
    priceStampDutyId: number;
    dateStart: string;
    published: boolean;
    rates: Array<{ stateCode: string; stateName: string; rate: number }>;
  }>;
  esl: Array<{
    priceEslId: number;
    dateStart: string;
    published: boolean;
    rates: Array<{
      stateCode: string;
      stateName: string;
      constructionRate: number;
      plantRate: number;
    }>;
  }>;
  plant: Array<{
    pricePlantId: number;
    dateStart: string;
    published: boolean;
    rate: number;
    plantMinValue: number;
    plantMaxValue: number;
  }>;
  terrorism: Array<{
    priceTerrorismId: number;
    dateStart: string;
    published: boolean;
    tiers: Array<{
      tier: string;
      rate: number;
      postcodeCount: number;
    }>;
  }>;
  brokerFees: Array<{
    brokerFeeScheduleId: number;
    dateStart: string;
    published: boolean;
    lines: Array<{
      sortOrder: number;
      name: string;
      fee: number;
      feeGst: number;
    }>;
  }>;
};
