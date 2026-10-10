/**
 * Typed export payload for legacy MSSQL → Postgres migration.
 */

export type LegacyDomainMeta = {
  source: string;
  exportedAt: string;
  database: string;
};

export type LegacyAccountManagerRow = {
  code: string;
  abbrev: string;
  fullName: string;
  email: string;
  arNumber: string;
  mobile: string;
};

export type LegacyAuthorisedRepresentativeRow = {
  authorisedRepresentativeId: number;
  fullName: string;
  companyName: string;
  arNumber: string;
  mobilePhone: string;
  businessPhone: string;
  email: string;
  ownBroker: boolean;
};

export type LegacyClientRow = {
  clientId: number;
  name: string;
  tradingName: string;
  abn: string;
  phone: string;
  email: string;
  accountManagerCode: string;
  clientSourceId: number;
  authorisedRepresentativeId: number | null;
  createdWhen: string | null;
};

export type LegacyPolicyRow = {
  policyId: number;
  clientId: number;
  policyNumber: string;
  /** Client-facing series base; set during legacy policy-number dedupe. */
  seriesNumber?: string;
  /** Term in series (0 = original); set during legacy policy-number dedupe. */
  seriesTerm?: number;
  policyAction: string;
  policyStatusId: number;
  postcode: string;
  stateCode: string;
  dateStart: string;
  dateEnd: string;
  insurerCode: string;
  createdWhen: string | null;
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
  manualTaxOverride: boolean;
  subLimits: LegacyPolicySubLimits;
  excludedContracts1: string;
  excludedContracts2: string;
  excludedContracts3: string;
  excesses: LegacyPolicyExcesses;
  wordings: LegacyPolicyWording[];
  notes: LegacyPolicyNote[];
  premium: LegacyPolicyPremium | null;
  rating: LegacyPolicyRating | null;
  adjustment: LegacyPolicyAdjustment | null;
};

export type LegacyPolicyPremium = {
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

export type LegacyPolicyRating = {
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
};

export type LegacyPolicyAdjustment = {
  adjustedTurnover: number;
  stampDutyExempt: boolean;
  adjustedTotalPremium: number;
  originalTotalPremium: number;
  adjustedDate: string | null;
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
  totalTotalPremium: number;
};

export type LegacyPolicySubLimits = {
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
  additionalCostOfWorking: string;
};

export type LegacyPolicyExcesses = {
  excessSection1A: string;
  excessSection1B: string;
  excessSection1C: string;
  excessSection1D: string;
  excessSection1E: string;
  excessSection2A: string;
  excessSection2B: string;
  excessSection2C: string;
  excessSection2D: string;
  excessSection2E: string;
  excessSection2F: string;
  excessAdditionalNotes: string;
};

export type LegacyPolicyWording = {
  carWordingId: number | null;
  subject: string;
  content: string;
};

export type LegacyPolicyNote = {
  policyNoteId: number;
  policyNoteTypeId: number;
  description: string;
  createdWhen: string | null;
  createdBy: string;
};

export type LegacyPolicyDocumentRow = {
  policyDocumentId: number;
  policyId: number;
  policyNumber: string;
  documentTypeCode: string;
  documentName: string;
  filename: string;
  generatedWhen: string | null;
};

export type LegacyDomainPayload = {
  meta: LegacyDomainMeta;
  accountManagers: LegacyAccountManagerRow[];
  authorisedRepresentatives: LegacyAuthorisedRepresentativeRow[];
  clients: LegacyClientRow[];
  policies: LegacyPolicyRow[];
  policyDocuments: LegacyPolicyDocumentRow[];
};

export type LegacyDomainSlice =
  "account-managers" | "ar" | "clients" | "policies" | "documents";
