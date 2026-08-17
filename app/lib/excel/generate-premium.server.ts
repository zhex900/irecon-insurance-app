import { z } from "zod";

import type { Policy, PolicyDocument } from "~/lib/db/types";
import {
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "~/lib/errors";
import {
  PREMIUM_EXCEL_FILENAME_PREFIX,
  PREMIUM_EXCEL_TEMPLATE_KEY,
} from "~/lib/excel/constants";
import type { ExcelWorkerBinding } from "~/lib/excel/excel-worker.server";
import type {
  Policy as ExcelPolicy,
  PremiumBreakdown as ExcelPremium,
  RatingSnapshot as ExcelRating,
} from "~/lib/excel/types";
import {
  trackDistribution,
  trackUsage,
} from "~/lib/observability/metrics.server";
import { getPolicy } from "~/lib/services/policy/data.service";

import type { GeneratePremiumExcelRequestData } from "../../../workers/excel/types/generate-types";

export const generatePremiumExcelBodySchema = z
  .object({
    policyId: z.string().uuid(),
  })
  .strict();

export const MAX_GENERATE_EXCEL_BODY_BYTES = 4_096;
const EXCEL_RPC_TIMEOUT_MS = 30_000;

function bytesToBase64(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64");
}

function toExcelPolicy(policy: Policy): ExcelPolicy {
  return {
    policyId: policy.policyId,
    policyNumber: policy.policyNumber,
    postcode: policy.postcode,
    stateId: policy.stateId,
    dateStart: policy.dateStart,
    dateEnd: policy.dateEnd,
    car: {
      coverTypeId: policy.car.coverTypeId,
      annualCoverTypeId: policy.car.annualCoverTypeId,
      siteAddress: policy.car.siteAddress,
      insuredName: policy.car.insuredName,
      estimatedTurnover: policy.car.estimatedTurnover,
      plantEquipment: policy.car.plantEquipment,
      existingStructure: policy.car.existingStructure,
      displayHomes: policy.car.displayHomes,
      contractWorksSumInsured: policy.car.contractWorksSumInsured,
      liabilityLimitBand: policy.car.liabilityLimitBand,
      contractWorksExistingStructurePremium:
        policy.car.contractWorksExistingStructurePremium,
      contractWorksDisplayHomesPremium:
        policy.car.contractWorksDisplayHomesPremium,
      premiumManualKeys: policy.car.premiumManualKeys,
      adjusted: policy.car.adjusted,
      adjustment: policy.car.adjustment
        ? { breakdown: policy.car.adjustment.breakdown }
        : undefined,
    },
  };
}

function toExcelPremium(
  premium: NonNullable<Policy["car"]["premium"]>,
): ExcelPremium {
  return {
    ...premium,
    contractWorksDisplayHomesPremium:
      premium.contractWorksDisplayHomesPremium ?? 0,
    contractWorksExistingStructurePremium:
      premium.contractWorksExistingStructurePremium ?? 0,
  };
}

function toExcelRating(
  rating: NonNullable<Policy["car"]["rating"]>,
): ExcelRating {
  return {
    contractWorksAppliedRate: rating.contractWorksAppliedRate,
    liabilityAppliedRate: rating.liabilityAppliedRate,
    contractWorksMinPremium: rating.contractWorksMinPremium,
    liabilityMinPremium: rating.liabilityMinPremium,
    eslRate: rating.eslRate,
    plantEslRate: rating.plantEslRate,
    plantRate: rating.plantRate,
    contractWorksStampDutyRate: rating.contractWorksStampDutyRate,
    liabilityStampDutyRate: rating.liabilityStampDutyRate,
    terrorismRate: rating.terrorismRate,
    terrorismTier: rating.terrorismTier,
    plantValueMin: rating.plantValueMin,
    plantValueMax: rating.plantValueMax,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ExternalServiceError("Excel generation timed out."));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function premiumWorkbookRequest(
  policy: Policy,
  premium: NonNullable<Policy["car"]["premium"]>,
  generatedBy: string,
): GeneratePremiumExcelRequestData {
  return {
    reportType: "premiumWorkbook",
    data: {
      policy: toExcelPolicy(policy),
      premium: toExcelPremium(premium),
      rating: policy.car.rating ? toExcelRating(policy.car.rating) : undefined,
      adjustment: policy.car.adjusted
        ? policy.car.adjustment?.breakdown
        : undefined,
    },
    options: {
      policyNumber: policy.policyNumber,
      generatedBy,
    },
  };
}

async function renderPremiumWorkbook(
  excelService: ExcelWorkerBinding,
  policy: Policy,
  premium: NonNullable<Policy["car"]["premium"]>,
  generatedBy: string,
): Promise<ArrayBuffer> {
  const started = Date.now();
  let response: Response;
  try {
    response = await withTimeout(
      excelService.generatePremiumExcel(
        premiumWorkbookRequest(policy, premium, generatedBy),
      ),
      EXCEL_RPC_TIMEOUT_MS,
    );
  } catch (error) {
    trackUsage("excel.premium", { result: "failure", reason: "unavailable" });
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError(
      "Excel generation is temporarily unavailable.",
    );
  }

  if (!response.ok) {
    await response.body?.cancel();
    trackUsage("excel.premium", {
      result: "failure",
      reason: "upstream_error",
    });
    throw new ExternalServiceError(
      "Excel generation is temporarily unavailable.",
    );
  }

  const bytes = await response.arrayBuffer();
  trackUsage("excel.premium", { result: "success" });
  trackDistribution("excel.premium.duration", Date.now() - started, {
    unit: "millisecond",
  });
  return bytes;
}

/** Load policy from DB and generate a premium workbook via the Excel worker. */
export async function generatePremiumExcelDocument(input: {
  policyId: string;
  generatedBy: string;
  excelService: ExcelWorkerBinding;
}): Promise<PolicyDocument> {
  const policy = await getPolicy(input.policyId);
  if (!policy) throw new NotFoundError("Policy not found");
  const premium = policy.car.premium;
  if (!premium) {
    throw new ValidationError("Premium not calculated");
  }

  const bytes = await renderPremiumWorkbook(
    input.excelService,
    policy,
    premium,
    input.generatedBy,
  );
  const filename = `${PREMIUM_EXCEL_FILENAME_PREFIX}-${policy.policyNumber || policy.policyId}.xlsx`;
  const contentBase64 = bytesToBase64(bytes);
  const when = new Date().toISOString();

  return {
    policyDocumentId: 0,
    policyId: policy.policyId,
    name: filename.replace(/\.xlsx$/i, ""),
    filename,
    generationKey: `excel|${policy.policyId}|${policy.car.adjusted ? "adjusted" : "unadjusted"}`,
    content: contentBase64,
    templateKey: PREMIUM_EXCEL_TEMPLATE_KEY,
    generatedWhen: when,
    generatedBy: input.generatedBy,
    pdfBase64: contentBase64,
  };
}
