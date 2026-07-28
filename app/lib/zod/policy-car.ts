import { z } from "zod";
import { stripAmountCommas } from "~/lib/amount-input";
import { visibleExcessFields } from "~/lib/excesses";

/** Free-text sub-limit wording (legacy varchar(100)). */
const subLimitText = z
  .string()
  .trim()
  .min(1, "Required")
  .max(100, "Must be 100 characters or fewer");

/** Required money: empty is invalid (do not coerce "" → 0). */
const moneyNumber = z.preprocess(
  (val) => {
    const stripped = stripAmountCommas(val);
    if (stripped === "" || stripped == null) return undefined;
    return stripped;
  },
  z.coerce.number({ error: "Required" }).min(0, "Must be 0 or greater"),
);

const moneyNumberPositive = z.preprocess(
  stripAmountCommas,
  z.coerce.number().positive("Estimated turnover must be greater than 0"),
);

const moneyNumberOptional = z.preprocess((val) => {
  const stripped = stripAmountCommas(val);
  if (stripped === "" || stripped == null) return undefined;
  return stripped;
}, z.coerce.number().min(0).optional());

const subLimitsSchema = z.object({
  removalOfDebris: subLimitText,
  expeditingExpenses: subLimitText,
  professionalFees: subLimitText,
  mitigationExpenses: subLimitText,
  searchAndLocateCosts: subLimitText,
  plantHireCharges: subLimitText,
  claimsPreparationCosts: subLimitText,
  governmentCosts: subLimitText,
  inflationProtection: subLimitText,
  employeesProperty: subLimitText,
  materialsInOffSiteStorage: subLimitText,
  transit: subLimitText,
});

const excessNumber = z.preprocess((val) => {
  const stripped = stripAmountCommas(val);
  if (stripped === "" || stripped == null) return "";
  return stripped;
}, z.string());

const excessesSchema = z.object({
  excessSection1A: excessNumber,
  excessSection1B: excessNumber,
  excessSection1C: excessNumber,
  excessSection1D: excessNumber,
  excessSection1E: excessNumber,
  excessAdditionalNotes: z.string().optional(),
  excessSection2A: excessNumber,
  excessSection2C: excessNumber,
  excessSection2D: excessNumber,
  excessSection2E: excessNumber,
  excessSection2F: excessNumber,
});

/** Policy status IDs from reference data (Pending / Taken / Not taken) */
export const POLICY_STATUS = {
  Pending: 1,
  Taken: 2,
  NotTaken: 3,
} as const;

/** Taken / Not taken — safe to import from client components (no DB deps). */
export function isTerminalStatus(policyStatusId: number) {
  return (
    policyStatusId === POLICY_STATUS.Taken ||
    policyStatusId === POLICY_STATUS.NotTaken
  );
}

const baseFields = {
  clientId: z.coerce.number(),
  policyStatusId: z.coerce
    .number()
    .int()
    .min(1, "'Status' is required")
    .max(3, "'Status' is required"),
  insurerCode: z.string().min(1, "Insurer is required"),
  insuredName: z.string().min(1, "Insured name is required"),
  coverTypeId: z.coerce.number().min(1, "Type of cover is required"),
  /** Required when cover type is Annual; cleared for Single / Owner Builder. */
  annualCoverTypeId: z.coerce.number().optional().nullable(),
  policyCategoryId: z.coerce.number().min(1, "Policy category is required"),
  policyNumber: z.string().optional(),
  siteAddress: z.string().optional().default(""),
  estimatedTurnover: moneyNumberPositive,
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Postcode is required"),
  stateId: z.coerce.number().min(1, "State is required"),
  businessActivities: z.string().min(1, "Business activities is required"),
  insuredContracts: z.string().min(1, "Insured contracts is required"),
  geographicalScopes: z.string().optional().default(""),
  maximumConstructionPeriod: z.coerce.number().int().positive(),
  maximumMaintenancePeriod: z.coerce.number().int().positive(),
  dateStart: z.string().min(1, "Policy from date is required"),
  dateEnd: z.string().min(1, "Policy end date is required"),
  hasExistingContractWorksCover: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      if (val === true || val === "true") return true;
      if (val === false || val === "false") return false;
      return val;
    },
    z.boolean({
      error:
        "Please answer whether you hold a current Contract Works/Liability policy",
    }),
  ),
  currentInsurer: z.string().optional(),
  contractWorksSumInsured: moneyNumber,
  displayHomes: moneyNumber,
  existingStructure: moneyNumber,
  section1DisplayHomes: z.coerce.number().min(0).default(0),
  section1ExistingStructure: z.coerce.number().min(0).default(0),
  plantEquipment: moneyNumber,
  liabilityLimitBand: z.coerce.number().min(1),
  claimsCountLast3Years: z.preprocess(
    (val) => {
      const stripped = stripAmountCommas(val);
      if (stripped === "" || stripped == null) return undefined;
      return stripped;
    },
    z.coerce.number({ error: "Required" }).int().min(0),
  ),
  anyClaimsExceed20k: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      if (val === true || val === "true") return true;
      if (val === false || val === "false") return false;
      return val;
    },
    z.boolean({
      error: "Please select whether any claims exceeded $20,000",
    }),
  ),
  declarationConfirmed: z.coerce.boolean(),
  subLimits: subLimitsSchema,
  excesses: excessesSchema,
  excludedContracts1: z.string().optional().default(""),
  excludedContracts2: z.string().optional().default(""),
  excludedContracts3: z.string().optional().default(""),
  selectedWordingIds: z.array(z.coerce.number()).default([]),
  customWordings: z
    .array(
      z.object({
        id: z.string(),
        subject: z.string(),
        content: z.string(),
      }),
    )
    .default([]),
};

type PolicyRuleFields = {
  policyCategoryId?: number;
  policyNumber?: string;
  hasExistingContractWorksCover?: boolean;
  currentInsurer?: string;
  coverTypeId?: number;
  annualCoverTypeId?: number | null;
  dateStart?: string;
  dateEnd?: string;
};

function addCalendarMonths(isoDate: string, months: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setMonth(date.getMonth() + months);
  return date;
}

function parseIsoDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function applyPolicyRules(data: PolicyRuleFields, ctx: z.RefinementCtx) {
  if (data.policyCategoryId === 2 && !data.policyNumber?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Policy number is required for renewal",
      path: ["policyNumber"],
    });
  }
  if (
    data.hasExistingContractWorksCover === true &&
    !data.currentInsurer?.trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Current insurer is required",
      path: ["currentInsurer"],
    });
  }
  if (data.coverTypeId === 1) {
    const annualType = Number(data.annualCoverTypeId);
    if (annualType !== 1 && annualType !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Annual type of cover is required",
        path: ["annualCoverTypeId"],
      });
    }
  }
  if (data.dateStart && data.dateEnd) {
    const end = parseIsoDate(data.dateEnd);
    if (data.coverTypeId === 1 || data.coverTypeId === 2) {
      const maxEnd = addCalendarMonths(data.dateStart, 18);
      if (end && maxEnd && end > maxEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "End date for annual policy and single project cannot exceed 18 months from Start Date",
          path: ["dateEnd"],
        });
      }
    }
    if (data.coverTypeId === 3) {
      const maxEnd = addCalendarMonths(data.dateStart, 12);
      if (end && maxEnd && end > maxEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End Date for Owner Builder cannot exceed 12 months",
          path: ["dateEnd"],
        });
      }
    }
  }
}

function applyExcessRules(
  data: {
    contractWorksSumInsured?: unknown;
    liabilityLimitBand?: unknown;
    excesses?: Record<string, string | undefined>;
  },
  ctx: z.RefinementCtx,
) {
  if (!data.excesses) return;
  const visible = visibleExcessFields({
    contractWorksSumInsured: data.contractWorksSumInsured,
    liabilityLimitBand: data.liabilityLimitBand,
  });
  for (const field of visible) {
    const raw = String(data.excesses[field.key] ?? "")
      .replace(/,/g, "")
      .trim();
    if (!raw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Required",
        path: ["excesses", field.key],
      });
    } else if (!/^\d+(\.\d+)?$/.test(raw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a number",
        path: ["excesses", field.key],
      });
    }
  }
}

const draftFields = {
  clientId: z.coerce.number(),
  policyStatusId: z.coerce.number().optional(),
  insurerCode: z.string().optional(),
  insuredName: z.string().optional(),
  coverTypeId: z.coerce.number().optional(),
  annualCoverTypeId: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return val;
  }, z.coerce.number().optional().nullable()),
  policyCategoryId: z.coerce.number().optional(),
  policyNumber: z.string().optional(),
  siteAddress: z.string().optional(),
  estimatedTurnover: moneyNumberOptional,
  postcode: z.string().optional(),
  stateId: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().optional()),
  businessActivities: z.string().optional(),
  insuredContracts: z.string().optional(),
  geographicalScopes: z.string().optional(),
  maximumConstructionPeriod: z.coerce.number().int().min(0).optional(),
  maximumMaintenancePeriod: z.coerce.number().int().min(0).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  hasExistingContractWorksCover: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (val === true || val === "true") return true;
    if (val === false || val === "false") return false;
    return val;
  }, z.boolean().optional()),
  currentInsurer: z.string().optional(),
  contractWorksSumInsured: moneyNumberOptional,
  displayHomes: moneyNumberOptional,
  existingStructure: moneyNumberOptional,
  section1DisplayHomes: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().min(0).optional()),
  section1ExistingStructure: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().min(0).optional()),
  plantEquipment: moneyNumberOptional,
  liabilityLimitBand: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  }, z.coerce.number().optional()),
  claimsCountLast3Years: z.preprocess((val) => {
    const stripped = stripAmountCommas(val);
    if (stripped === "" || stripped == null) return undefined;
    return stripped;
  }, z.coerce.number().int().min(0).optional()),
  anyClaimsExceed20k: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (val === true || val === "true") return true;
    if (val === false || val === "false") return false;
    return val;
  }, z.boolean().optional()),
  declarationConfirmed: z.coerce.boolean().optional(),
  subLimits: subLimitsSchema.partial().optional(),
  excesses: excessesSchema.partial().optional(),
  excludedContracts1: z.string().optional(),
  excludedContracts2: z.string().optional(),
  excludedContracts3: z.string().optional(),
  selectedWordingIds: z.array(z.coerce.number()).optional(),
  customWordings: z.preprocess(
    (val) => (val == null ? [] : val),
    z
      .array(
        z.object({
          id: z.string(),
          subject: z.string(),
          content: z.string(),
        }),
      )
      .optional(),
  ),
  /** Optional manual premium override saved with the draft. */
  premium: z.record(z.string(), z.number()).optional(),
};

/** Autosave / leave-without-full-validation — do not enforce Taken-gate rules. */
export const carPolicyDraftSchema = z.object(draftFields);

/** Minimum fields required for premium calculation */
export const carPolicyPricingSchema = z
  .object({
    coverTypeId: z.coerce.number().min(1),
    estimatedTurnover: moneyNumberPositive,
    postcode: z.string().regex(/^\d{4}$/),
    stateId: z.coerce.number().min(1),
    dateStart: z.string().min(1),
    contractWorksSumInsured: moneyNumber,
    displayHomes: moneyNumber,
    existingStructure: moneyNumber,
    plantEquipment: moneyNumber,
    liabilityLimitBand: z.coerce.number().min(1),
    claimsCountLast3Years: z.preprocess(
      (val) => {
        const stripped = stripAmountCommas(val);
        if (stripped === "" || stripped == null) return undefined;
        return stripped;
      },
      z.coerce.number({ error: "Required" }).int().min(0),
    ),
    anyClaimsExceed20k: z.preprocess(
      (val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        if (val === true || val === "true") return true;
        if (val === false || val === "false") return false;
        return val;
      },
      z.boolean({
        error: "Please select whether any claims exceeded $20,000",
      }),
    ),
    hasExistingContractWorksCover: z.preprocess((val) => {
      if (val === true || val === "true") return true;
      if (val === false || val === "false") return false;
      return val;
    }, z.boolean()),
  })
  .passthrough();

export const carPolicySchema = z
  .object({
    ...baseFields,
    declarationConfirmed: z.coerce.boolean().refine((value) => value === true, {
      message: "Duty of disclosure confirmation is required",
    }),
  })
  .superRefine(applyPolicyRules)
  .superRefine(applyExcessRules);

export type CarPolicyFormValues = z.infer<typeof carPolicySchema>;

export const wizardSteps = [
  "Risk Details",
  "Limits of Liability",
  "Excesses",
  "Claims",
  "Premium",
] as const;

export const wizardStepFields: Record<number, (keyof CarPolicyFormValues)[]> = {
  0: [
    "insurerCode",
    "insuredName",
    "coverTypeId",
    "annualCoverTypeId",
    "policyCategoryId",
    "policyNumber",
    "siteAddress",
    "postcode",
    "stateId",
    "estimatedTurnover",
    "businessActivities",
    "insuredContracts",
    "geographicalScopes",
    "maximumConstructionPeriod",
    "maximumMaintenancePeriod",
    "dateStart",
    "dateEnd",
    "hasExistingContractWorksCover",
    "currentInsurer",
  ],
  1: [
    "contractWorksSumInsured",
    "displayHomes",
    "existingStructure",
    "plantEquipment",
    "subLimits",
    "liabilityLimitBand",
  ],
  2: ["excesses"],
  3: [
    "claimsCountLast3Years",
    "anyClaimsExceed20k",
    "excludedContracts1",
    "excludedContracts2",
    "excludedContracts3",
    "declarationConfirmed",
    "selectedWordingIds",
    "customWordings",
  ],
  4: ["policyStatusId"],
};

export const pricingFields = [
  "coverTypeId",
  "estimatedTurnover",
  "postcode",
  "stateId",
  "dateStart",
  "contractWorksSumInsured",
  "displayHomes",
  "existingStructure",
  "plantEquipment",
  "liabilityLimitBand",
  "claimsCountLast3Years",
  "anyClaimsExceed20k",
  "hasExistingContractWorksCover",
] as const satisfies readonly (keyof CarPolicyFormValues)[];
