import type { CustomWordingItem } from "~/lib/policies/custom-wordings";

export type State = {
  stateId: number;
  code: string;
  name: string;
};

export type CoverType = {
  coverTypeId: number;
  name: string;
};

export type AnnualCoverType = {
  annualCoverTypeId: number;
  code: string;
  name: string;
};

export type PolicyCategory = {
  policyCategoryId: number;
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
  /** Legacy AccountManager.EmailAddress — email signature merge. */
  email: string;
  /** Legacy AccountManager.ARNumber — PDF/email AccountManagerARNumber. */
  arNumber: string;
  /** Legacy AccountManager.Mobile — Direct phone in email signature. */
  mobile: string;
};

/** Legacy WholesaleBroker → Phase 1 AuthorisedRepresentative. */
export type WholesaleBroker = {
  authorisedRepresentativeId: number;
  fullName: string;
  companyName: string;
  arNumber: string;
  email: string;
};

export type CarWording = {
  carWordingId: number;
  subject: string;
  content: string;
};

export type Client = {
  clientId: string;
  /** Registered / legal name (legacy `Name`). */
  name: string;
  tradingName: string;
  abn: string;
  phone: string;
  email: string;
  accountManagerId: number;
  /** Legacy ClientSource — How did you find us. */
  clientSourceId: number;
  /** Legacy WholesaleBroker binding. */
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

/** Broker/user message notes (editable). Referral notes use type 2. */
export const POLICY_MESSAGE_NOTE_TYPE_ID = 3;

export type PolicyNote = {
  policyNoteId: number;
  policyId: string;
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
  excessPlantEquipment: string;
  excessUpTo2MMinorPerils: string;
  excessUpTo2MMajorPerils: string;
  excessOver2MMinorPerils: string;
  excessOver2MMajorPerils: string;
  excessAdditionalNotes: string;
  excessWorkerToWorker: string;
  excessUpTo2MLimit10M: string;
  excessUpTo2MLimit20M: string;
  excessOver2MLimit10M: string;
  excessOver2MLimit20M: string;
};

export type PolicySummary = {
  policyId: string;
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

export type PolicyDocument = {
  policyDocumentId: number;
  policyId: string;
  name: string;
  filename: string;
  /** Fingerprint of the policy snapshot used to generate this pack. */
  generationKey: string;
  /** Human-readable summary / library placeholder text. */
  content: string;
  /** pdfme template key (generated docs). Absent for library attachments. */
  templateKey?: string;
  /** Library document id when this row was copied from Library Documents. */
  libraryDocumentId?: number;
  /** Legacy MERGEFIELD → value map used for generation / regeneration. */
  mergeInputs?: Record<string, string>;
  /** Optional cached PDF (base64) from last generate. */
  pdfBase64?: string;
  generatedWhen: string;
  generatedBy: string;
};

export type Policy = {
  policyId: string;
  clientId: string;
  policyNumber: string;
  policyCategoryId: number;
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
  documents?: PolicyDocument[];
  car: {
    coverTypeId: number;
    /** Set when cover type is Annual; null otherwise. */
    annualCoverTypeId?: number | null;
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
    customWordings: CustomWordingItem[];
    /**
     * Transient PDF helper: ticked catalogue + custom `{ subject, content }` rows.
     * Set by form snapshot; not persisted to app_extras.
     */
    endorsementWordings?: Array<{ subject: string; content: string }>;
    /** Derived from customWordings[0] for PDF merge fields. */
    customWordingSubject?: string;
    customWordingContent?: string;
    /** Derived from customWordings[1] for PDF merge fields. */
    customWordingSubject2?: string;
    customWordingContent2?: string;
    referralReasons?: string[];
    premium?: PremiumBreakdown;
    /** Premium Breakdown keys the broker manually edited (persisted in app_extras). */
    premiumManualKeys?: string[];
    rating?: RatingSnapshot;
    adjusted?: boolean;
    adjustment?: CarAdjustmentRecord;
  };
};

export type AppRole = "broker" | "admin" | "super-admin";

export type BrokerSession = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  authorisedRepresentativeId: number;
  avatarR2Key: string | null;
};

export type AppUser = {
  userId: string;
  fullName: string;
  email: string;
  role: AppRole;
  authorisedRepresentativeId: number | null;
  disabled: boolean;
  /** R2 key/version when a custom avatar is set. */
  avatarR2Key: string | null;
  createdWhen: string;
};

export type AuditLogEntry = {
  auditLogId: number;
  occurredAt: string;
  actorUserId: string | null;
  actorEmail: string;
  actorName: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  requestPath: string | null;
};

export type ReferenceData = {
  states: State[];
  coverTypes: CoverType[];
  annualCoverTypes: AnnualCoverType[];
  policyCategories: PolicyCategory[];
  policyStatuses: PolicyStatus[];
  liabilityLimitBands: { id: number; name: string }[];
  insurers: { code: string; name: string }[];
  accountManagers: AccountManager[];
  /** Live ARs from DB when loaded via getReferenceDataAsync. */
  wholesaleBrokers: WholesaleBroker[];
  feeNames: { name: string; sortOrder: number; fee: number; feeGst: number }[];
  defaultSubLimits: {
    annual: CarSubLimits;
    ownerBuilder: CarSubLimits;
  };
  defaultExcesses: Omit<CarExcesses, "excessAdditionalNotes">;
  defaultTexts: {
    businessActivities: string;
    insuredContractsAnnualTransfer: string;
    insuredContractsAnnualContractCommencing: string;
    insuredContractsSingle: string;
    geographicalScopeAnnual: string;
    excludedContracts1: string;
    excludedContracts2: string;
    excludedContracts3: string;
  };
};
