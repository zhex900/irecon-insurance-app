// 10% GST

import type {
  PremiumExcelRateRefs,
  PremiumExcelSheetContext,
} from "./excel-types"; 
import {
  formatCurrencyCell,
  setPercentCell,
  styleWorkbookHeaderRow,
} from "./excel-workbook";

const GST_RATE = 0.1;

export function addPremiumExcelRatesSheet(
  workbook: import("exceljs").Workbook,
  ctx: PremiumExcelSheetContext,
): PremiumExcelRateRefs {
  const { premium, rating } = ctx;
  const car = ctx.policy?.car;

  const rates = workbook.addWorksheet("Rates");
  rates.getColumn(1).width = 36;
  rates.getColumn(2).width = 18;
  rates.getColumn(3).width = 48;

  rates.mergeCells("A1:B1");
  rates.getCell("A1").value = "Pricing rates";
  rates.getCell("A1").font = { bold: true, size: 14 };

  rates.getCell("A2").value = "Rate";
  rates.getCell("B2").value = "Value";
  rates.getCell("C2").value = "Source / notes";
  styleWorkbookHeaderRow(rates.getRow(2), 3);

  // Calculate actual rates from premium for precision (matching adjustment sheet logic)
  const premiumData = premium as {
    contractWorksBasePremium?: number;
    contractWorksTerrorismPremium?: number;
    contractWorksPlantPremium?: number;
    contractWorksPlantTerrorismPremium?: number;
    contractWorksPlantESL?: number;
    contractWorksESL?: number;
    contractWorksGST?: number;
    contractWorksStampDuty?: number;
    liabilityBasePremium?: number;
    liabilityESL?: number;
    liabilityGST?: number;
    liabilityStampDuty?: number;
  };

  const s1Base = premiumData.contractWorksBasePremium || 0;
  const s1Terror = premiumData.contractWorksTerrorismPremium || 0;
  const s1Plant = premiumData.contractWorksPlantPremium || 0;
  const s1PlantTerror = premiumData.contractWorksPlantTerrorismPremium || 0;
  const s1PlantEsl = premiumData.contractWorksPlantESL || 0;
  const s1Esl = premiumData.contractWorksESL || 0;
  const s1Gst = premiumData.contractWorksGST || 0;
  const s1Sd = premiumData.contractWorksStampDuty || 0;
  const s2Base = premiumData.liabilityBasePremium || 0;
  const s2Esl = premiumData.liabilityESL || 0;
  const s2Gst = premiumData.liabilityGST || 0;
  const s2Sd = premiumData.liabilityStampDuty || 0;
  const turnover = car?.estimatedTurnover || 0;

  const terrorDenom = s1Base;
  const eslDenom = s1Base + s1Terror;
  const sd1Denom =
    s1Base + s1Terror + s1Plant + s1PlantTerror + s1PlantEsl + s1Esl + s1Gst;
  const sd2Denom = s2Base + s2Esl + s2Gst;

  // Helper function to round to 6 decimal places
  function roundRate(value: number): number {
    return Math.round(value * 1e6) / 1e6;
  }

  function rateFromPremium(
    numerator: number,
    denominator: number,
    fallback: number,
  ): number {
    if (!(denominator > 0) || !Number.isFinite(numerator)) return fallback;
    return roundRate(numerator / denominator);
  }

  // Calculate applied rates like the adjustment sheet does
  function resolveAppliedRate(
    beforeBase: number,
    trueBase: number,
    turnover: number,
    fallback: number,
  ): number {
    if (!(turnover > 0)) return fallback;
    const numerator = beforeBase < trueBase ? beforeBase : trueBase;
    return roundRate(numerator / turnover);
  }

  // Calculate actual rates from premium
  const calculatedCwAppliedRate = resolveAppliedRate(
    premium?.contractWorksCalculatedBasePremium || 0,
    s1Base,
    turnover,
    rating?.contractWorksAppliedRate || 0,
  );
  const calculatedLlAppliedRate = resolveAppliedRate(
    premium?.liabilityCalculatedBasePremium || 0,
    s2Base,
    turnover,
    rating?.liabilityAppliedRate || 0,
  );
  const calculatedTerrorismRate = rateFromPremium(
    s1Terror,
    terrorDenom,
    rating?.terrorismRate || 0,
  );
  const calculatedEslRate = rateFromPremium(
    s1Esl,
    eslDenom,
    rating?.eslRate || 0,
  );
  const calculatedCwStampDutyRate = rateFromPremium(
    s1Sd,
    sd1Denom,
    rating?.contractWorksStampDutyRate || 0,
  );
  const calculatedLlStampDutyRate = rateFromPremium(
    s2Sd,
    sd2Denom,
    rating?.liabilityStampDutyRate || 0,
  );

  const rateRows: Array<
    [string, number | string, string, "money" | "pct" | "text"]
  > = [
    [
      "Contract works applied rate",
      calculatedCwAppliedRate,
      "price_* schedule",
      "pct",
    ],
    [
      "Contract works min premium",
      rating?.contractWorksMinPremium ?? 0,
      "price_* schedule",
      "money",
    ],
    [
      "Liability applied rate",
      calculatedLlAppliedRate,
      "price_* schedule",
      "pct",
    ],
    [
      "Liability min premium",
      rating?.liabilityMinPremium ?? 0,
      "price_* schedule",
      "money",
    ],
    ["Plant premium rate", rating?.plantRate ?? 0, "price_plant", "pct"],
    ["ESL rate (construction)", calculatedEslRate, "price_esl", "pct"],
    [
      "Plant ESL rate",
      rating?.plantEslRate ?? rating?.eslRate ?? 0,
      "price_esl",
      "pct",
    ],
    [
      "Stamp duty rate (section 1)",
      calculatedCwStampDutyRate,
      "price_stamp_duty",
      "pct",
    ],
    [
      "Stamp duty rate (section 2)",
      calculatedLlStampDutyRate,
      "price_stamp_duty",
      "pct",
    ],
    [
      "Terrorism rate (τ)",
      calculatedTerrorismRate,
      rating?.terrorismTier
        ? `Tier ${rating.terrorismTier}`
        : "price_terrorism_rate",
      "pct",
    ],
    [
      "Terrorism tier",
      rating?.terrorismTier || "—",
      "Postcode / state lookup",
      "text",
    ],
    ["GST rate", GST_RATE, "", "pct"],
    ["Plant value min", rating?.plantValueMin ?? 0, "price_plant", "money"],
    ["Plant value max", rating?.plantValueMax ?? 0, "price_plant", "money"],
  ];

  const RATE: PremiumExcelRateRefs = {
    cwRate: "Rates!$B$3",
    cwMin: "Rates!$B$4",
    llRate: "Rates!$B$5",
    llMin: "Rates!$B$6",
    plantRate: "Rates!$B$7",
    esl: "Rates!$B$8",
    plantEsl: "Rates!$B$9",
    sd1: "Rates!$B$10",
    sd2: "Rates!$B$11",
    terror: "Rates!$B$12",
    gst: "Rates!$B$14",
  };

  rateRows.forEach(([label, value, note, kind], index) => {
    const row = 3 + index;
    rates.getCell(`A${row}`).value = label;
    const cell = rates.getCell(`B${row}`);
    if (kind === "pct") setPercentCell(cell, Number(value) || 0);
    else if (kind === "money") {
      cell.value = Number(value) || 0;
      formatCurrencyCell(cell);
    } else cell.value = value;
    rates.getCell(`C${row}`).value = note;
  });

  return RATE;
}
