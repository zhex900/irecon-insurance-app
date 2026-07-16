export type State = {
  stateId: number;
  code: string;
  name: string;
};

export type CoverType = {
  coverTypeId: number;
  name: string;
};

export type EntityType = {
  entityTypeId: number;
  name: string;
};

export type BusinessType = {
  businessTypeId: number;
  code: string;
  name: string;
};

export type PolicyStatus = {
  policyStatusId: number;
  name: string;
};

export type AccountManager = {
  accountManagerId: number;
  fullName: string;
  abbrev: string;
};

export type CarWording = {
  carWordingId: number;
  subject: string;
  content: string;
};

export type Client = {
  clientId: number;
  name: string;
  tradingName: string;
  entityTypeId: number;
  accountManagerId: number;
  authorisedRepresentativeId: number;
  createdWhen: string;
  createdBy: string;
};

export type PremiumBreakdown = {
  contractWorksCalculatedBasePremium: number;
  contractWorksBasePremium: number;
  contractWorksPlantPremium: number;
  contractWorksPlantESL: number;
  contractWorksESL: number;
  contractWorksGST: number;
  contractWorksStampDuty: number;
  contractWorksTerrorismPremium: number;
  contractWorksPlantTerrorismPremium: number;
  contractWorksDisplayHomesPremium: number;
  contractWorksExistingStructurePremium: number;
  contractWorksTotalPremium: number;
  liabilityCalculatedBasePremium: number;
  liabilityBasePremium: number;
  liabilityESL: number;
  liabilityGST: number;
  liabilityStampDuty: number;
  liabilityTotalPremium: number;
  combinedBrokerFee: number;
  originalTotalPremium: number;
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

export type PolicyNote = {
  policyNoteId: number;
  policyId: number;
  policyNoteTypeId: number;
  description: string;
  createdWhen: string;
  createdBy: string;
};

export type CarSubLimits = {
  removalOfDebris: string;
  expeditingExpenses: string;
  professionalFees: string;
  mitigationExpenses: string;
  searchAndLocateCosts: string;
  plantHireCharges: string;
  claimsPreparationCosts: string;
  governmentCosts: string;
  inflationProtection: string;
  employeesProperty: string;
  materialsInOffSiteStorage: string;
  transit: string;
};

export type CarExcesses = {
  excessSection1A: string;
  excessSection1B: string;
  excessSection1C: string;
  excessSection1D: string;
  excessSection1E: string;
  excessAdditionalNotes: string;
  excessSection2A: string;
  excessSection2C: string;
  excessSection2D: string;
  excessSection2E: string;
  excessSection2F: string;
};

export type PolicySummary = {
  policyId: number;
  policyNumber: string;
  insuredName: string;
  clientName: string;
  policyStatusId: number;
  isDraft?: boolean;
};

export type AdjustmentSectionRow = {
  totalPremium: number;
  trueBasePremium: number;
  terrorismPremium: number;
  esl: number;
  gst: number;
  sd: number;
};

export type AdjustmentBreakdown = {
  originalTurnover: number;
  adjustmentTurnover: number;
  stampDutyExempt: boolean;
  original: {
    section1: AdjustmentSectionRow;
    section2: AdjustmentSectionRow;
    total: AdjustmentSectionRow;
  };
  adjustment: {
    section1: AdjustmentSectionRow;
    section2: AdjustmentSectionRow;
    total: AdjustmentSectionRow;
  };
  delta: {
    section1: AdjustmentSectionRow;
    section2: AdjustmentSectionRow;
    total: AdjustmentSectionRow;
  };
};

export type CarAdjustmentRecord = {
  adjustedTurnover: number;
  stampDutyExempt: boolean;
  adjustedDate: string;
  breakdown: AdjustmentBreakdown;
  adjustedContractWorksBasePremium: number;
  adjustedContractWorksTerrorismPremium: number;
  adjustedSection1Esl: number;
  adjustedSection1Gst: number;
  adjustedSection1Sd: number;
  adjustedContractWorksTotalPremium: number;
  adjustedLiabilityBasePremium: number;
  adjustedSection2Esl: number;
  adjustedSection2Gst: number;
  adjustedSection2Sd: number;
  adjustedLiabilityTotalPremium: number;
  totalContractWorksBasePremium: number;
  totalContractWorksTerrorismPremium: number;
  totalSection1Esl: number;
  totalSection1Gst: number;
  totalSection1Sd: number;
  totalContractWorksTotalPremium: number;
  totalLiabilityBasePremium: number;
  totalSection2Esl: number;
  totalSection2Gst: number;
  totalSection2Sd: number;
  totalLiabilityTotalPremium: number;
  adjustedTotalPremium: number;
};

export type Quote = {
  policyId: number;
  clientId: number;
  policyNumber: string;
  businessTypeId: number;
  policyStatusId: number;
  postcode: string;
  stateId: number;
  dateEffective: string;
  dateStart: string;
  dateEnd: string;
  createdWhen: string;
  createdBy: string;
  insurerCode: string;
  isDraft?: boolean;
  notes?: PolicyNote[];
  car: {
    coverTypeId: number;
    siteAddress: string;
    insuredName: string;
    estimatedTurnover: number;
    businessActivities: string;
    insuredContracts: string;
    geographicalScopes: string;
    plantEquipment: number;
    existingStructure: number;
    displayHomes: number;
    claimsCountLast3Years: number;
    anyClaimsExceed20k: boolean;
    declarationConfirmed: boolean;
    contractWorksSumInsured: number;
    liabilityLimitBand: number;
    hasExistingContractWorksCover: boolean;
    currentInsurer: string;
    maximumConstructionPeriod: number;
    maximumMaintenancePeriod: number;
    contractWorksExistingStructurePremium: number;
    contractWorksDisplayHomesPremium: number;
    subLimits: CarSubLimits;
    excesses: CarExcesses;
    excludedContracts1: string;
    excludedContracts2: string;
    excludedContracts3: string;
    selectedWordingIds: number[];
    customWordingSubject?: string;
    customWordingContent?: string;
    referralReasons?: string[];
    premium?: PremiumBreakdown;
    rating?: RatingSnapshot;
    adjusted?: boolean;
    adjustment?: CarAdjustmentRecord;
  };
};

export type BrokerSession = {
  id: string;
  fullName: string;
  email: string;
  authorisedRepresentativeId: number;
};

export type ReferenceData = {
  states: State[];
  coverTypes: CoverType[];
  entityTypes: EntityType[];
  businessTypes: BusinessType[];
  policyStatuses: PolicyStatus[];
  liabilityLimitBands: { id: number; name: string }[];
  insurers: { code: string; name: string }[];
  accountManagers: AccountManager[];
  feeNames: { name: string; sortOrder: number; fee: number; feeGst: number }[];
  defaultSubLimits: {
    annual: CarSubLimits;
    ownerBuilder: CarSubLimits;
  };
  defaultExcesses: Omit<CarExcesses, "excessAdditionalNotes">;
  defaultTexts: {
    businessActivities: string;
    insuredContractsAnnual: string;
    insuredContractsSingle: string;
    geographicalScopeAnnual: string;
    excludedContracts1: string;
    excludedContracts2: string;
    excludedContracts3: string;
  };
};
