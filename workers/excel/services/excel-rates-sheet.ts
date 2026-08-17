import { GST_RATE } from "~/constants";
import { resolveAdjustmentRates } from "~/server/pricing/car-adjustment-calculator";

import type {
  PremiumExcelRateRefs,
  PremiumExcelSheetContext,
} from "./excel-types";
import {
  formatCurrencyCell,
  setPercentCell,
  styleWorkbookHeaderRow,
} from "./excel-workbook";

export function addPremiumExcelRatesSheet(
  workbook: import("exceljs").Workbook,
  ctx: PremiumExcelSheetContext,
): PremiumExcelRateRefs {
  const { premium, rating } = ctx;
  const turnover = ctx.policy.car.estimatedTurnover || 0;
  const frozen = rating
    ? resolveAdjustmentRates(premium, rating, turnover)
    : null;

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

  const rateRows: Array<
    [string, number | string, string, "money" | "pct" | "text"]
  > = [
    [
      "Contract works applied rate",
      frozen?.contractWorksAppliedRate ?? rating?.contractWorksAppliedRate ?? 0,
      "price_* schedule",
      "pct",
    ],
    [
      "Contract works min premium",
      frozen?.contractWorksMinPremium ?? rating?.contractWorksMinPremium ?? 0,
      "price_* schedule",
      "money",
    ],
    [
      "Liability applied rate",
      frozen?.liabilityAppliedRate ?? rating?.liabilityAppliedRate ?? 0,
      "price_* schedule",
      "pct",
    ],
    [
      "Liability min premium",
      frozen?.liabilityMinPremium ?? rating?.liabilityMinPremium ?? 0,
      "price_* schedule",
      "money",
    ],
    ["Plant premium rate", rating?.plantRate ?? 0, "price_plant", "pct"],
    [
      "ESL rate (construction)",
      frozen?.eslRate ?? rating?.eslRate ?? 0,
      "price_esl",
      "pct",
    ],
    [
      "Plant ESL rate",
      rating?.plantEslRate ?? rating?.eslRate ?? 0,
      "price_esl",
      "pct",
    ],
    [
      "Stamp duty rate (section 1)",
      frozen?.contractWorksStampDutyRate ??
        rating?.contractWorksStampDutyRate ??
        0,
      "price_stamp_duty",
      "pct",
    ],
    [
      "Stamp duty rate (section 2)",
      frozen?.liabilityStampDutyRate ?? rating?.liabilityStampDutyRate ?? 0,
      "price_stamp_duty",
      "pct",
    ],
    [
      "Terrorism rate (τ)",
      frozen?.terrorismRate ?? rating?.terrorismRate ?? 0,
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
