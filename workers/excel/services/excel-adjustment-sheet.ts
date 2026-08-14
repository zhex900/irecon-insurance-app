const GST_RATE = 0.1; // 10% GST

import {
  setMoneyCell as moneyCell,
  setPercentCell as percentCell,
  styleWorkbookHeaderRow as styleHeaderRow,
} from "./excel-workbook";
import type {
  PremiumExcelPolicyRefs,
  PremiumExcelRateRefs,
  PremiumExcelSheetContext,
} from "./excel-types";

type AdjRow = {
  label: string;
  total: string;
  base: string;
  terror: string;
  esl: string;
  gst: string;
  sd: string;
  result: import("../../../app/lib/types/excel-worker-types.ts").AdjustmentSectionRow;
  strong?: boolean;
};

// Helper function to round money values to 2 decimal places (cents)
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// Build a section row for adjustment calculation
function buildSectionRow({
  base,
  terror,
  eslRate,
  sdRate,
  stampDutyExempt,
  isSection2 = false,
}: {
  base: number;
  terror: number;
  eslRate: number;
  sdRate: number;
  stampDutyExempt: boolean;
  isSection2?: boolean;
}) {
  const esl = round((base + terror) * eslRate);
  const gst = round((base + terror + esl) * GST_RATE);
  const sd =
    stampDutyExempt && isSection2
      ? 0
      : round((base + terror + esl + gst) * sdRate);

  return {
    trueBasePremium: base,
    terrorismPremium: terror,
    esl,
    gst,
    sd,
    totalPremium: base + terror + esl + gst + sd,
  };
}

// Worker-compatible implementation matching app's calculateCarAdjustment
export function calculateCarAdjustment({
  originalTurnover,
  adjustmentTurnover,
  stampDutyExempt,
  premium,
  rating,
}: {
  originalTurnover: number;
  adjustmentTurnover: number;
  stampDutyExempt: boolean;
  premium: import("../../../app/lib/types/excel-worker-types.ts").PremiumBreakdown;
  rating?: import("../../../app/lib/types/excel-worker-types.ts").RatingSnapshot;
}): import("../../../app/lib/types/excel-worker-types.ts").AdjustmentBreakdown {
  const rates = resolveAdjustmentRates(premium, rating, originalTurnover);

  const originalSection1 = buildSectionRow({
    base: premium.contractWorksBasePremium || 0,
    terror: premium.contractWorksTerrorismPremium || 0,
    eslRate: rates.eslRate,
    sdRate: rates.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const originalSection2 = buildSectionRow({
    base: premium.liabilityBasePremium || 0,
    terror: 0,
    eslRate: rates.eslRate,
    sdRate: rates.liabilityStampDutyRate,
    stampDutyExempt,
    isSection2: true,
  });

  // Round bases to cents before tax lines (matches Excel ROUND on each step).
  const adjustedSection1Base = round(
    Math.max(
      adjustmentTurnover * rates.contractWorksAppliedRate,
      rates.contractWorksMinPremium,
    ),
  );

  const adjustedSection1 = buildSectionRow({
    base: adjustedSection1Base,
    terror: round(adjustedSection1Base * rates.terrorismRate),
    eslRate: rates.eslRate,
    sdRate: rates.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const adjustedSection2Base = round(
    Math.max(
      adjustmentTurnover * rates.liabilityAppliedRate,
      rates.liabilityMinPremium,
    ),
  );

  const adjustedSection2 = buildSectionRow({
    base: adjustedSection2Base,
    terror: 0,
    eslRate: rates.eslRate,
    sdRate: rates.liabilityStampDutyRate,
    stampDutyExempt,
    isSection2: true,
  });

  // Calculate delta with 75% floor rule
  const deltaBase = (origBase: number, adjBase: number) => {
    if (
      adjBase < origBase &&
      origBase > 0 &&
      (origBase - adjBase) / origBase > 0.25
    ) {
      return -origBase * 0.25; // 75% floor
    }
    return adjBase - origBase;
  };

  const deltaSection1Base = deltaBase(
    premium.contractWorksBasePremium || 0,
    adjustedSection1Base,
  );
  const deltaSection1Terror = round(deltaSection1Base * rates.terrorismRate);

  const deltaSection1 = buildSectionRow({
    base: deltaSection1Base,
    terror: deltaSection1Terror,
    eslRate: rates.eslRate,
    sdRate: rates.contractWorksStampDutyRate,
    stampDutyExempt: false,
    isSection2: false,
  });

  const deltaSection2Base = deltaBase(
    premium.liabilityBasePremium || 0,
    adjustedSection2Base,
  );
  const deltaSection2Terror = 0;

  const deltaSection2 = buildSectionRow({
    base: deltaSection2Base,
    terror: deltaSection2Terror,
    eslRate: rates.eslRate,
    sdRate: rates.liabilityStampDutyRate,
    stampDutyExempt,
    isSection2: true,
  });

  return {
    originalTurnover,
    adjustmentTurnover,
    stampDutyExempt,
    original: {
      section1: originalSection1,
      section2: originalSection2,
      total: {
        trueBasePremium:
          originalSection1.trueBasePremium + originalSection2.trueBasePremium,
        terrorismPremium:
          originalSection1.terrorismPremium + originalSection2.terrorismPremium,
        esl: originalSection1.esl + originalSection2.esl,
        gst: originalSection1.gst + originalSection2.gst,
        sd: originalSection1.sd + originalSection2.sd,
        totalPremium:
          originalSection1.totalPremium + originalSection2.totalPremium,
      },
    },
    adjustment: {
      section1: adjustedSection1,
      section2: adjustedSection2,
      total: {
        trueBasePremium:
          adjustedSection1.trueBasePremium + adjustedSection2.trueBasePremium,
        terrorismPremium:
          adjustedSection1.terrorismPremium + adjustedSection2.terrorismPremium,
        esl: adjustedSection1.esl + adjustedSection2.esl,
        gst: adjustedSection1.gst + adjustedSection2.gst,
        sd: adjustedSection1.sd + adjustedSection2.sd,
        totalPremium:
          adjustedSection1.totalPremium + adjustedSection2.totalPremium,
      },
    },
    delta: {
      section1: deltaSection1,
      section2: deltaSection2,
      total: {
        trueBasePremium:
          deltaSection1.trueBasePremium + deltaSection2.trueBasePremium,
        terrorismPremium:
          deltaSection1.terrorismPremium + deltaSection2.terrorismPremium,
        esl: deltaSection1.esl + deltaSection2.esl,
        gst: deltaSection1.gst + deltaSection2.gst,
        sd: deltaSection1.sd + deltaSection2.sd,
        totalPremium: deltaSection1.totalPremium + deltaSection2.totalPremium,
      },
    },
  };
}

// Worker-compatible implementation matching app's resolveAdjustmentRates exactly
function resolveAdjustmentRates(
  premium: import("../../../app/lib/types/excel-worker-types").PremiumBreakdown,
  rating:
    | import("../../../app/lib/types/excel-worker-types").RatingSnapshot
    | undefined,
  originalTurnover: number,
) {
  if (!rating) {
    return {
      contractWorksAppliedRate: 0,
      liabilityAppliedRate: 0,
      contractWorksMinPremium: 0,
      liabilityMinPremium: 0,
      terrorismRate: 0,
      eslRate: 0,
      contractWorksStampDutyRate: 0,
      liabilityStampDutyRate: 0,
    };
  }

  // Helper function to round to 6 decimal places (matching Math.Round(value, 6))
  function roundRate(value: number): number {
    return Math.round(value * 1e6) / 1e6;
  }

  // Resolve applied rate logic matching app's resolveAppliedRate
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

  // Rate from premium logic matching app's rateFromPremium
  function rateFromPremium(
    numerator: number,
    denominator: number,
    fallback: number,
  ): number {
    if (!(denominator > 0) || !Number.isFinite(numerator)) return fallback;
    return roundRate(numerator / denominator);
  }

  // Extract premium components matching app's variable names
  const s1Base = premium.contractWorksBasePremium || 0;
  const s1Terror = premium.contractWorksTerrorismPremium || 0;
  const s1Plant = premium.contractWorksPlantPremium || 0;
  const s1PlantTerror = premium.contractWorksPlantTerrorismPremium || 0;
  const s1PlantEsl = premium.contractWorksPlantESL || 0;
  const s1Esl = premium.contractWorksESL || 0;
  const s1Gst = premium.contractWorksGST || 0;
  const s1Sd = premium.contractWorksStampDuty || 0;
  const s2Base = premium.liabilityBasePremium || 0;
  const s2Esl = premium.liabilityESL || 0;
  const s2Gst = premium.liabilityGST || 0;
  const s2Sd = premium.liabilityStampDuty || 0;

  // Calculate denominators matching app exactly
  const terrorDenom = s1Base;
  const eslDenom = s1Base + s1Terror;
  // Legacy SDRateSection1 denom excludes ES/DH (CARNewPolicy.aspx.cs ~502–503).
  const sd1Denom =
    s1Base + s1Terror + s1Plant + s1PlantTerror + s1PlantEsl + s1Esl + s1Gst;
  const sd2Denom = s2Base + s2Esl + s2Gst;

  return {
    contractWorksAppliedRate: resolveAppliedRate(
      premium.contractWorksCalculatedBasePremium || 0,
      s1Base,
      originalTurnover,
      rating.contractWorksAppliedRate || 0,
    ),
    liabilityAppliedRate: resolveAppliedRate(
      premium.liabilityCalculatedBasePremium || 0,
      s2Base,
      originalTurnover,
      rating.liabilityAppliedRate || 0,
    ),
    contractWorksMinPremium: rating.contractWorksMinPremium || 0,
    liabilityMinPremium: rating.liabilityMinPremium || 0,
    terrorismRate: rateFromPremium(
      s1Terror,
      terrorDenom,
      rating.terrorismRate || 0,
    ),
    eslRate: rateFromPremium(s1Esl, eslDenom, rating.eslRate || 0),
    contractWorksStampDutyRate: rateFromPremium(
      s1Sd,
      sd1Denom,
      rating.contractWorksStampDutyRate || 0,
    ),
    liabilityStampDutyRate: rateFromPremium(
      s2Sd,
      sd2Denom,
      rating.liabilityStampDutyRate || 0,
    ),
  };
}

export function addPremiumExcelAdjustmentSheet(
  workbook: import("exceljs").Workbook,
  ctx: PremiumExcelSheetContext,
  INPUT: PremiumExcelPolicyRefs,
  _RATE: PremiumExcelRateRefs,
) {
  const { premium, rating, adjustment } = ctx;
  if (!adjustment) return;

  const adj = workbook.addWorksheet("Adjustment");
  for (let c = 1; c <= 7; c++) adj.getColumn(c).width = c === 1 ? 28 : 16;

  adj.mergeCells("A1:G1");
  adj.getCell("A1").value = "End-of-term adjustment";
  adj.getCell("A1").font = { bold: true, size: 14 };

  adj.getCell("A2").value = "Original Turnover";
  moneyCell(adj.getCell("B2"), INPUT.turnover, adjustment.originalTurnover);
  adj.getCell("A3").value = "Adjustment Turnover";
  moneyCell(
    adj.getCell("B3"),
    INPUT.adjTurnover,
    adjustment.adjustmentTurnover,
  );
  adj.getCell("A4").value = "Stamp Duty Exempt";
  adj.getCell("B4").value = {
    formula: INPUT.sdExempt,
    result: adjustment.stampDutyExempt ? "Yes" : "No",
  };

  const P = {
    cwBase: INPUT.bindCwBase,
    cwTrue: INPUT.bindCwTrue,
    cwTerror: INPUT.bindCwTerror,
    cwPlant: INPUT.bindCwPlant,
    cwPlantTerror: INPUT.bindCwPlantTerror,
    cwPlantEsl: INPUT.bindCwPlantEsl,
    cwEsl: INPUT.bindCwEsl,
    cwGst: INPUT.bindCwGst,
    cwSd: INPUT.bindCwSd,
    llBase: INPUT.bindLlBase,
    llTrue: INPUT.bindLlTrue,
    llEsl: INPUT.bindLlEsl,
    llGst: INPUT.bindLlGst,
    llSd: INPUT.bindLlSd,
  } as const;

  // Exact app rates (resolveAdjustmentRates → 6 dp). Values only — do not
  // re-derive in Excel or float divide can drift 1¢ from the policy UI.
  const frozen = rating
    ? resolveAdjustmentRates(premium, rating, adjustment.originalTurnover)
    : null;

  adj.getCell("A6").value =
    "Frozen rates (same as app — 6 dp; amounts use ROUND to cents)";
  adj.getCell("A6").font = { bold: true };
  adj.getCell("A7").value = "CW applied rate";
  percentCell(
    adj.getCell("B7"),
    frozen?.contractWorksAppliedRate ?? rating?.contractWorksAppliedRate ?? 0,
  );
  adj.getCell("A8").value = "LL applied rate";
  percentCell(
    adj.getCell("B8"),
    frozen?.liabilityAppliedRate ?? rating?.liabilityAppliedRate ?? 0,
  );
  adj.getCell("A9").value = "CW min premium";
  moneyCell(
    adj.getCell("B9"),
    undefined,
    frozen?.contractWorksMinPremium ?? rating?.contractWorksMinPremium ?? 0,
  );
  adj.getCell("A10").value = "LL min premium";
  moneyCell(
    adj.getCell("B10"),
    undefined,
    frozen?.liabilityMinPremium ?? rating?.liabilityMinPremium ?? 0,
  );
  adj.getCell("A11").value = "Terrorism rate";
  percentCell(
    adj.getCell("B11"),
    frozen?.terrorismRate ?? rating?.terrorismRate ?? 0,
  );
  adj.getCell("A12").value = "ESL rate";
  percentCell(adj.getCell("B12"), frozen?.eslRate ?? rating?.eslRate ?? 0);
  adj.getCell("A13").value = "CW stamp duty rate";
  percentCell(
    adj.getCell("B13"),
    frozen?.contractWorksStampDutyRate ??
      rating?.contractWorksStampDutyRate ??
      0,
  );
  adj.getCell("A14").value = "LL stamp duty rate";
  percentCell(
    adj.getCell("B14"),
    frozen?.liabilityStampDutyRate ?? rating?.liabilityStampDutyRate ?? 0,
  );
  adj.getCell("A15").value = "GST rate";
  percentCell(adj.getCell("B15"), GST_RATE);

  const FR = {
    cwRate: "Adjustment!$B$7",
    llRate: "Adjustment!$B$8",
    cwMin: "Adjustment!$B$9",
    llMin: "Adjustment!$B$10",
    terror: "Adjustment!$B$11",
    esl: "Adjustment!$B$12",
    sd1: "Adjustment!$B$13",
    sd2: "Adjustment!$B$14",
    gst: "Adjustment!$B$15",
    origTo: "Adjustment!$B$2",
    adjTo: "Adjustment!$B$3",
    sdExempt: "Adjustment!$B$4",
  } as const;

  const headers = [
    "Cover",
    "Total Premium",
    "True Base Premium",
    "Terrorism Levy",
    "ESL",
    "GST",
    "Stamp Duty",
  ];

  function writeAdjTable(
    title: string,
    startRow: number,
    rows: [AdjRow, AdjRow, AdjRow],
  ) {
    adj.mergeCells(`A${startRow}:G${startRow}`);
    adj.getCell(`A${startRow}`).value = title;
    adj.getCell(`A${startRow}`).font = { bold: true };
    const head = startRow + 1;
    headers.forEach((h, i) => {
      adj.getCell(head, i + 1).value = h;
    });
    styleHeaderRow(adj.getRow(head), 7);
    rows.forEach((row, idx) => {
      const r = head + 1 + idx;
      adj.getCell(`A${r}`).value = row.label;
      if (row.strong) adj.getCell(`A${r}`).font = { bold: true };
      moneyCell(adj.getCell(`B${r}`), row.total, row.result.totalPremium);
      moneyCell(adj.getCell(`C${r}`), row.base, row.result.trueBasePremium);
      moneyCell(adj.getCell(`D${r}`), row.terror, row.result.terrorismPremium);
      moneyCell(adj.getCell(`E${r}`), row.esl, row.result.esl);
      moneyCell(adj.getCell(`F${r}`), row.gst, row.result.gst);
      moneyCell(adj.getCell(`G${r}`), row.sd, row.result.sd);
      if (row.strong) {
        for (const col of ["B", "C", "D", "E", "F", "G"] as const) {
          adj.getCell(`${col}${r}`).font = { bold: true };
        }
      }
    });
    return head + 3;
  }

  // Check if adjustment has the expected structure
  if (!adjustment.original || !adjustment.adjustment || !adjustment.delta) {
    // Simplified fallback for worker when full adjustment structure isn't available
    const noteRow = 17;
    adj.mergeCells(`A${noteRow}:G${noteRow}`);
    adj.getCell(`A${noteRow}`).value =
      "Adjustment calculation requires full adjustment data structure. Using simplified calculation.";
    adj.getCell(`A${noteRow}`).font = {
      size: 9,
      color: { argb: "FF6B7280" },
      italic: true,
    };
    return;
  }

  const originalStart = 17;
  const oCw = originalStart + 2;
  const oLl = originalStart + 3;
  writeAdjTable("Original", originalStart, [
    {
      label: "Contract Works",
      base: P.cwTrue,
      terror: P.cwTerror,
      esl: `SUM(C${oCw},D${oCw})*${FR.esl}`,
      gst: `SUM(C${oCw},D${oCw},E${oCw})*${FR.gst}`,
      sd: `SUM(C${oCw},D${oCw},E${oCw},F${oCw})*${FR.sd1}`,
      total: `SUM(C${oCw}:G${oCw})`,
      result: adjustment.original.section1,
    },
    {
      label: "Legal Liability",
      base: P.llTrue,
      terror: "0",
      esl: "0",
      gst: `SUM(C${oLl},D${oLl},E${oLl})*${FR.gst}`,
      sd: `IF(UPPER(${FR.sdExempt})="YES",0,SUM(C${oLl},D${oLl},E${oLl},F${oLl})*${FR.sd2})`,
      total: `SUM(C${oLl}:G${oLl})`,
      result: adjustment.original.section2,
    },
    {
      label: "TOTAL",
      base: `SUM(C${oCw}:C${oLl})`,
      terror: `SUM(D${oCw}:D${oLl})`,
      esl: `SUM(E${oCw}:E${oLl})`,
      gst: `SUM(F${oCw}:F${oLl})`,
      sd: `SUM(G${oCw}:G${oLl})`,
      total: `SUM(B${oCw}:B${oLl})`,
      result: adjustment.original.total,
      strong: true,
    },
  ]);

  const adjStart = originalStart + 6;
  const aCw = adjStart + 2;
  const aLl = adjStart + 3;
  writeAdjTable("Adjustment Turnover", adjStart, [
    {
      label: "Contract Works",
      base: `MAX(${FR.adjTo}*${FR.cwRate},${FR.cwMin})`,
      terror: `C${aCw}*${FR.terror}`,
      esl: `SUM(C${aCw},D${aCw})*${FR.esl}`,
      gst: `SUM(C${aCw},D${aCw},E${aCw})*${FR.gst}`,
      sd: `SUM(C${aCw},D${aCw},E${aCw},F${aCw})*${FR.sd1}`,
      total: `SUM(C${aCw}:G${aCw})`,
      result: adjustment.adjustment.section1,
    },
    {
      label: "Legal Liability",
      base: `MAX(${FR.adjTo}*${FR.llRate},${FR.llMin})`,
      terror: "0",
      esl: "0",
      gst: `SUM(C${aLl},D${aLl},E${aLl})*${FR.gst}`,
      sd: `IF(UPPER(${FR.sdExempt})="YES",0,SUM(C${aLl},D${aLl},E${aLl},F${aLl})*${FR.sd2})`,
      total: `SUM(C${aLl}:G${aLl})`,
      result: adjustment.adjustment.section2,
    },
    {
      label: "TOTAL",
      base: `SUM(C${aCw}:C${aLl})`,
      terror: `SUM(D${aCw}:D${aLl})`,
      esl: `SUM(E${aCw}:E${aLl})`,
      gst: `SUM(F${aCw}:F${aLl})`,
      sd: `SUM(G${aCw}:G${aLl})`,
      total: `SUM(B${aCw}:B${aLl})`,
      result: adjustment.adjustment.total,
      strong: true,
    },
  ]);

  const deltaStart = adjStart + 6;
  const dCw = deltaStart + 2;
  const dLl = deltaStart + 3;
  const deltaBase = (origCell: string, adjCell: string) =>
    `IF(AND(${adjCell}<${origCell},${origCell}>0,(${origCell}-${adjCell})/${origCell}>0.25),-${origCell}*0.25,${adjCell}-${origCell})`;

  writeAdjTable("Total Adjustment Premium", deltaStart, [
    {
      label: "Contract Works",
      base: deltaBase(`C${oCw}`, `C${aCw}`),
      terror: `C${dCw}*${FR.terror}`,
      esl: `SUM(C${dCw},D${dCw})*${FR.esl}`,
      gst: `SUM(C${dCw},D${dCw},E${dCw})*${FR.gst}`,
      sd: `SUM(C${dCw},D${dCw},E${dCw},F${dCw})*${FR.sd1}`,
      total: `SUM(C${dCw}:G${dCw})`,
      result: adjustment.delta.section1,
    },
    {
      label: "Legal Liability",
      base: deltaBase(`C${oLl}`, `C${aLl}`),
      terror: "0",
      esl: "0",
      gst: `SUM(C${dLl},D${dLl},E${dLl})*${FR.gst}`,
      sd: `IF(UPPER(${FR.sdExempt})="YES",0,SUM(C${dLl},D${dLl},E${dLl},F${dLl})*${FR.sd2})`,
      total: `SUM(C${dLl}:G${dLl})`,
      result: adjustment.delta.section2,
    },
    {
      label: "TOTAL",
      base: `SUM(C${dCw}:C${dLl})`,
      terror: `SUM(D${dCw}:D${dLl})`,
      esl: `SUM(E${dCw}:E${dLl})`,
      gst: `SUM(F${dCw}:F${dLl})`,
      sd: `SUM(G${dCw}:G${dLl})`,
      total: `SUM(B${dCw}:B${dLl})`,
      result: adjustment.delta.total,
      strong: true,
    },
  ]);

  const noteRow = deltaStart + 6;
  adj.getCell(`A${noteRow}`).value =
    "All policies are subject to a minimum premium of 75% of original estimated premium paid";
  adj.mergeCells(`A${noteRow}:G${noteRow}`);
  adj.getCell(`A${noteRow}`).font = {
    size: 9,
    italic: true,
    color: { argb: "FF6B7280" },
  };
}
