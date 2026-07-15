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

export type PolicyAction = {
  policyActionId: number;
  code: string;
  name: string;
};

export type CarStatus = {
  carStatusId: number;
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
  arId: number;
  createdWhen: string;
  createdBy: string;
};

export type PremiumBreakdown = {
  section1BeforeBasePremium: number;
  section1TrueBasePremium: number;
  section1PlantEquipment: number;
  section1PlantEsl: number;
  section1Esl: number;
  section1Gst: number;
  section1Sd: number;
  section1TerrorismPremium: number;
  section1PlantTerrorismPremium: number;
  section1DisplayHomes: number;
  section1ExistingStructure: number;
  section1TotalPremium: number;
  section2BeforeBasePremium: number;
  section2TrueBasePremium: number;
  section2Esl: number;
  section2Gst: number;
  section2Sd: number;
  section2TotalPremium: number;
  combinedBrokerFee: number;
  originalTotalPremium: number;
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
  carStatusId: number;
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
  adjustedSection1TrueBasePremium: number;
  adjustedSection1TerrorismPremium: number;
  adjustedSection1Esl: number;
  adjustedSection1Gst: number;
  adjustedSection1Sd: number;
  adjustedSection1TotalPremium: number;
  adjustedSection2TrueBasePremium: number;
  adjustedSection2Esl: number;
  adjustedSection2Gst: number;
  adjustedSection2Sd: number;
  adjustedSection2TotalPremium: number;
  totalSection1TrueBasePremium: number;
  totalSection1TerrorismPremium: number;
  totalSection1Esl: number;
  totalSection1Gst: number;
  totalSection1Sd: number;
  totalSection1TotalPremium: number;
  totalSection2TrueBasePremium: number;
  totalSection2Esl: number;
  totalSection2Gst: number;
  totalSection2Sd: number;
  totalSection2TotalPremium: number;
  adjustedTotalPremium: number;
};

export type Quote = {
  policyId: number;
  clientId: number;
  policyNumber: string;
  policyActionId: number;
  carStatusId: number;
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
    numberOfClaim: number;
    anyClaimsExceed20k: boolean;
    confirmation: boolean;
    section1Value: number;
    section2Value: number;
    holdCurrentContractWorks: boolean;
    currentInsurer: string;
    maximumConstructionPeriod: number;
    maximumMaintenancePeriod: number;
    section1ExistingStructure: number;
    section1DisplayHomes: number;
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
  arId: number;
};

export type ReferenceData = {
  states: State[];
  coverTypes: CoverType[];
  entityTypes: EntityType[];
  policyActions: PolicyAction[];
  carStatuses: CarStatus[];
  section2Values: { id: number; name: string }[];
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
