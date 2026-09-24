/**
 * Zod schemas for Excel worker request validation
 * Single source of truth for all worker data structures
 */

import { z } from "zod";

// Base request schema matching ExcelWorkerRequest interface
export const excelWorkerRequestSchema = z.object({
  reportType: z.enum([
    "policy",
    "client",
    "premium",
    "custom",
    "export",
    "premiumWorkbook",
  ]),
  data: z.unknown(),
  options: z
    .object({
      includeFormulas: z.boolean().optional(),
      formatCurrency: z.boolean().optional(),
      sheetName: z.string().optional(),
      title: z.string().optional(),
      includeTimestamp: z.boolean().optional(),
      premiumWorkbook: z
        .object({
          policyNumber: z.string().optional(),
          clientName: z.string().optional(),
          appVersion: z.string().optional(),
          includeAdjustment: z.boolean().optional(),
          generatedBy: z.string().optional(),
          existing: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
});

const MAX_CUSTOM_COLUMNS = 50;
const MAX_CUSTOM_ROWS = 5_000;

// Custom report data validation
export const customReportDataSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string().max(100),
        header: z.string().max(200),
        width: z.number().optional(),
        type: z.enum(["text", "currency", "integer", "date"]).optional(),
      }),
    )
    .max(MAX_CUSTOM_COLUMNS),
  rows: z
    .array(z.record(z.string().max(100), z.union([z.string(), z.number()])))
    .max(MAX_CUSTOM_ROWS),
});

const policyCarSchema = z.object({
  coverTypeId: z.number(),
  annualCoverTypeId: z.number().nullable().optional(),
  siteAddress: z.string().max(2000),
  insuredName: z.string().max(500),
  estimatedTurnover: z.number(),
  plantEquipment: z.number(),
  existingStructure: z.number(),
  displayHomes: z.number(),
  contractWorksSumInsured: z.number(),
  liabilityLimitBand: z.number(),
  contractWorksExistingStructurePremium: z.number(),
  contractWorksDisplayHomesPremium: z.number(),
  premiumManualKeys: z.array(z.string().max(100)).max(50).optional(),
  adjusted: z.boolean().optional(),
});

const policySchema = z.object({
  policyId: z.string().min(1).max(100),
  policyNumber: z.string().max(100),
  seriesNumber: z.string().max(100).optional(),
  postcode: z.string().max(20).optional(),
  stateId: z.number(),
  dateStart: z.string().max(40).optional(),
  dateEnd: z.string().max(40).optional(),
  car: policyCarSchema,
});

const premiumBreakdownSchema = z.object({
  contractWorksCalculatedBasePremium: z.number(),
  contractWorksBasePremium: z.number(),
  contractWorksPlantPremium: z.number(),
  contractWorksPlantESL: z.number(),
  contractWorksESL: z.number(),
  contractWorksGST: z.number(),
  contractWorksStampDuty: z.number(),
  contractWorksTerrorismPremium: z.number(),
  contractWorksPlantTerrorismPremium: z.number(),
  contractWorksDisplayHomesPremium: z.number(),
  contractWorksExistingStructurePremium: z.number(),
  contractWorksTotalPremium: z.number(),
  liabilityCalculatedBasePremium: z.number(),
  liabilityBasePremium: z.number(),
  liabilityESL: z.number(),
  liabilityGST: z.number(),
  liabilityStampDuty: z.number(),
  liabilityTotalPremium: z.number(),
  combinedBrokerFee: z.number(),
  originalTotalPremium: z.number(),
});

const ratingSnapshotSchema = z.object({
  contractWorksAppliedRate: z.number(),
  liabilityAppliedRate: z.number(),
  contractWorksMinPremium: z.number(),
  liabilityMinPremium: z.number(),
  eslRate: z.number(),
  plantEslRate: z.number(),
  plantRate: z.number(),
  contractWorksStampDutyRate: z.number(),
  liabilityStampDutyRate: z.number(),
  terrorismRate: z.number(),
  terrorismTier: z.string().max(50),
  plantValueMin: z.number().optional(),
  plantValueMax: z.number().optional(),
});

const adjustmentSectionRowSchema = z.object({
  totalPremium: z.number(),
  trueBasePremium: z.number(),
  terrorismPremium: z.number(),
  esl: z.number(),
  gst: z.number(),
  sd: z.number(),
});

const adjustmentBlockSchema = z.object({
  section1: adjustmentSectionRowSchema,
  section2: adjustmentSectionRowSchema,
  total: adjustmentSectionRowSchema,
});

const adjustmentBreakdownSchema = z.object({
  originalTurnover: z.number(),
  adjustmentTurnover: z.number(),
  stampDutyExempt: z.boolean(),
  original: adjustmentBlockSchema,
  adjustment: adjustmentBlockSchema,
  delta: adjustmentBlockSchema,
});

export const premiumWorkbookDataSchema = z.object({
  policy: policySchema,
  premium: premiumBreakdownSchema,
  rating: ratingSnapshotSchema.optional(),
  adjustment: adjustmentBreakdownSchema.optional(),
});

export const generatePremiumExcelRequestSchema = z.object({
  reportType: z.literal("premiumWorkbook"),
  data: premiumWorkbookDataSchema,
  options: z
    .object({
      policyNumber: z.string().max(100).optional(),
      generatedBy: z.string().max(500).optional(),
      appVersion: z.string().max(50).optional(),
    })
    .optional(),
});

export const generateGenericExcelRequestSchema = z.object({
  reportType: z.literal("custom"),
  data: z.unknown(),
  options: excelWorkerRequestSchema.shape.options,
});

export type ExcelWorkerRequest = z.infer<typeof excelWorkerRequestSchema>;
export type GeneratePremiumExcelRequestData = z.infer<
  typeof generatePremiumExcelRequestSchema
>;
export type GenerateGenericExcelRequestData = z.infer<
  typeof generateGenericExcelRequestSchema
>;
