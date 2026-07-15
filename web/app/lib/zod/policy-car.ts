import { z } from "zod";

const subLimitsSchema = z.object({
  removalOfDebris: z.string().min(1),
  expeditingExpenses: z.string().min(1),
  professionalFees: z.string().min(1),
  mitigationExpenses: z.string().min(1),
  searchAndLocateCosts: z.string().min(1),
  plantHireCharges: z.string().min(1),
  claimsPreparationCosts: z.string().min(1),
  governmentCosts: z.string().min(1),
  inflationProtection: z.string().min(1),
  employeesProperty: z.string().min(1),
  materialsInOffSiteStorage: z.string().min(1),
  transit: z.string().min(1),
});

const excessesSchema = z.object({
  excessSection1A: z.string().min(1),
  excessSection1B: z.string().min(1),
  excessSection1C: z.string().min(1),
  excessSection1D: z.string().min(1),
  excessSection1E: z.string().min(1),
  excessAdditionalNotes: z.string().optional(),
  excessSection2A: z.string().min(1),
  excessSection2C: z.string().min(1),
  excessSection2D: z.string().min(1),
  excessSection2E: z.string().min(1),
  excessSection2F: z.string().min(1),
});

/** CAR status IDs from reference data */
export const CAR_STATUS = {
  Pending: 1,
  Taken: 2,
  NotTaken: 3,
} as const;

const baseFields = {
  clientId: z.coerce.number(),
  carStatusId: z.coerce
    .number()
    .int()
    .min(1, "'Status' is required")
    .max(3, "'Status' is required"),
  insurerCode: z.string().min(1, "Insurer is required"),
  insuredName: z.string().min(1, "Insured name is required"),
  coverTypeId: z.coerce.number().min(1, "Type of cover is required"),
  policyActionId: z.coerce.number().min(1, "Policy category is required"),
  policyNumber: z.string().optional(),
  siteAddress: z.string().min(1, "Site address is required"),
  estimatedTurnover: z.coerce
    .number()
    .positive("Estimated turnover must be greater than 0"),
  postcode: z
    .string()
    .regex(/^\d{4}$/, "Postcode of construction must be 4 digits"),
  stateId: z.coerce.number().min(1, "State of construction is required"),
  businessActivities: z.string().min(1, "Business activities is required"),
  insuredContracts: z.string().min(1, "Insured contracts is required"),
  geographicalScopes: z.string().min(1, "Geographical scope is required"),
  maximumConstructionPeriod: z.coerce.number().int().positive(),
  maximumMaintenancePeriod: z.coerce.number().int().positive(),
  dateStart: z.string().min(1, "Policy start date is required"),
  dateEnd: z.string().min(1, "Policy end date is required"),
  holdCurrentContractWorks: z.coerce.boolean(),
  currentInsurer: z.string().optional(),
  section1Value: z.coerce.number().min(0),
  displayHomes: z.coerce.number().min(0),
  existingStructure: z.coerce.number().min(0),
  section1DisplayHomes: z.coerce.number().min(0).default(0),
  section1ExistingStructure: z.coerce.number().min(0).default(0),
  plantEquipment: z.coerce.number().min(0),
  section2Value: z.coerce.number().min(1),
  numberOfClaim: z.coerce.number().int().min(0),
  anyClaimsExceed20k: z.coerce.boolean(),
  confirmation: z.coerce.boolean(),
  subLimits: subLimitsSchema,
  excesses: excessesSchema,
  excludedContracts1: z.string().optional(),
  excludedContracts2: z.string().optional(),
  excludedContracts3: z.string().optional(),
  selectedWordingIds: z.array(z.coerce.number()).default([]),
  customWordingEnabled: z.coerce.boolean().default(false),
  customWordingSubject: z.string().optional(),
  customWordingContent: z.string().optional(),
};

type PolicyRuleFields = {
  policyActionId?: number;
  policyNumber?: string;
  holdCurrentContractWorks?: boolean;
  currentInsurer?: string;
};

function applyPolicyRules(data: PolicyRuleFields, ctx: z.RefinementCtx) {
  if (data.policyActionId === 2 && !data.policyNumber?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Policy number is required for renewal",
      path: ["policyNumber"],
    });
  }
  if (data.holdCurrentContractWorks && !data.currentInsurer?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Current insurer is required",
      path: ["currentInsurer"],
    });
  }
}

const draftFields = {
  clientId: z.coerce.number(),
  carStatusId: z.coerce.number().optional(),
  insurerCode: z.string().optional(),
  insuredName: z.string().optional(),
  coverTypeId: z.coerce.number().optional(),
  policyActionId: z.coerce.number().optional(),
  policyNumber: z.string().optional(),
  siteAddress: z.string().optional(),
  estimatedTurnover: z.coerce.number().min(0).optional(),
  postcode: z.string().optional(),
  stateId: z.coerce.number().optional(),
  businessActivities: z.string().optional(),
  insuredContracts: z.string().optional(),
  geographicalScopes: z.string().optional(),
  maximumConstructionPeriod: z.coerce.number().int().min(0).optional(),
  maximumMaintenancePeriod: z.coerce.number().int().min(0).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  holdCurrentContractWorks: z.coerce.boolean().optional(),
  currentInsurer: z.string().optional(),
  section1Value: z.coerce.number().min(0).optional(),
  displayHomes: z.coerce.number().min(0).optional(),
  existingStructure: z.coerce.number().min(0).optional(),
  section1DisplayHomes: z.coerce.number().min(0).optional(),
  section1ExistingStructure: z.coerce.number().min(0).optional(),
  plantEquipment: z.coerce.number().min(0).optional(),
  section2Value: z.coerce.number().optional(),
  numberOfClaim: z.coerce.number().int().min(0).optional(),
  anyClaimsExceed20k: z.coerce.boolean().optional(),
  confirmation: z.coerce.boolean().optional(),
  subLimits: subLimitsSchema.partial().optional(),
  excesses: excessesSchema.partial().optional(),
  excludedContracts1: z.string().optional(),
  excludedContracts2: z.string().optional(),
  excludedContracts3: z.string().optional(),
  selectedWordingIds: z.array(z.coerce.number()).optional(),
  customWordingEnabled: z.coerce.boolean().optional(),
  customWordingSubject: z.string().optional(),
  customWordingContent: z.string().optional(),
};

export const carQuoteDraftSchema = z
  .object(draftFields)
  .superRefine(applyPolicyRules);

/** Minimum fields required for premium calculation */
export const carQuotePricingSchema = z
  .object({
    coverTypeId: z.coerce.number().min(1),
    estimatedTurnover: z.coerce.number().positive(),
    postcode: z.string().regex(/^\d{4}$/),
    stateId: z.coerce.number().min(1),
    dateStart: z.string().min(1),
    section1Value: z.coerce.number().min(0),
    displayHomes: z.coerce.number().min(0),
    existingStructure: z.coerce.number().min(0),
    plantEquipment: z.coerce.number().min(0),
    section2Value: z.coerce.number().min(1),
    numberOfClaim: z.coerce.number().int().min(0),
    anyClaimsExceed20k: z.coerce.boolean(),
    holdCurrentContractWorks: z.coerce.boolean(),
  })
  .passthrough();

export const carQuoteSchema = z
  .object({
    ...baseFields,
    confirmation: z.coerce.boolean().refine((value) => value === true, {
      message: "Duty of disclosure confirmation is required",
    }),
  })
  .superRefine(applyPolicyRules);

export type CarQuoteFormValues = z.infer<typeof carQuoteSchema>;

export const wizardSteps = [
  "Risk Details",
  "Section 1",
  "Section 2 & Excesses",
  "Claims & Wording",
  "Review",
  "Pricing Confirmation",
] as const;

export const wizardStepFields: Record<number, (keyof CarQuoteFormValues)[]> = {
  0: [
    "insurerCode",
    "insuredName",
    "coverTypeId",
    "policyActionId",
    "policyNumber",
    "siteAddress",
    "estimatedTurnover",
    "postcode",
    "stateId",
    "businessActivities",
    "insuredContracts",
    "geographicalScopes",
    "maximumConstructionPeriod",
    "maximumMaintenancePeriod",
    "dateStart",
    "dateEnd",
    "holdCurrentContractWorks",
    "currentInsurer",
  ],
  1: [
    "section1Value",
    "displayHomes",
    "existingStructure",
    "plantEquipment",
    "subLimits",
  ],
  2: ["section2Value", "excesses"],
  3: [
    "numberOfClaim",
    "anyClaimsExceed20k",
    "excludedContracts1",
    "excludedContracts2",
    "excludedContracts3",
    "confirmation",
    "selectedWordingIds",
    "customWordingEnabled",
    "customWordingSubject",
    "customWordingContent",
  ],
};

export const pricingFields = [
  "coverTypeId",
  "estimatedTurnover",
  "postcode",
  "stateId",
  "dateStart",
  "section1Value",
  "displayHomes",
  "existingStructure",
  "plantEquipment",
  "section2Value",
  "numberOfClaim",
  "anyClaimsExceed20k",
  "holdCurrentContractWorks",
] as const satisfies readonly (keyof CarQuoteFormValues)[];
