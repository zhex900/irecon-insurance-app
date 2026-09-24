/**
 * Minimal type definitions for Excel Worker.
 * Simplified versions of app types to avoid heavy dependencies.
 *
 * Shared between main app and Excel Worker service.
 */

export interface CarInfo {
  coverTypeId: number;
  annualCoverTypeId?: number | null;
  siteAddress: string;
  insuredName: string;
  estimatedTurnover: number;
  plantEquipment: number;
  existingStructure: number;
  displayHomes: number;
  contractWorksSumInsured: number;
  liabilityLimitBand: number;
  contractWorksExistingStructurePremium: number;
  contractWorksDisplayHomesPremium: number;
  premiumManualKeys?: string[];
  adjusted?: boolean;
  adjustment?: {
    breakdown?: AdjustmentBreakdown;
  };
}

export interface Policy {
  policyId: string;
  policyNumber: string;
  seriesNumber?: string;
  postcode?: string;
  stateId: number;
  dateStart?: string;
  dateEnd?: string;
  car: CarInfo;
}

export interface PremiumBreakdown {
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
}

export interface RatingSnapshot {
  contractWorksAppliedRate: number;
  liabilityAppliedRate: number;
  contractWorksMinPremium: number;
  liabilityMinPremium: number;
  eslRate: number;
  plantEslRate: number;
  plantRate: number;
  contractWorksStampDutyRate: number;
  liabilityStampDutyRate: number;
  terrorismRate: number;
  terrorismTier: string;
  plantValueMin?: number;
  plantValueMax?: number;
}

export interface AdjustmentSectionRow {
  totalPremium: number;
  trueBasePremium: number;
  terrorismPremium: number;
  esl: number;
  gst: number;
  sd: number;
}

export interface AdjustmentBreakdown {
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
}
