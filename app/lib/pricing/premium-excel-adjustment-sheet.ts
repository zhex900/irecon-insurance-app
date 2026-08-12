import type { AdjustmentBreakdown } from "~/lib/db/types";
import { GST_RATE } from "~/constants";
import {
  setMoneyCell as moneyCell,
  setPercentCell as percentCell,
  styleWorkbookHeaderRow as styleHeaderRow,
} from "~/lib/pricing/premium-excel-workbook";
import { resolveAdjustmentRates } from "~/server/pricing/car-adjustment-calculator";
import type {
  PremiumExcelPolicyRefs,
  PremiumExcelRateRefs,
  PremiumExcelSheetContext,
} from "~/lib/pricing/premium-excel-types";

type AdjRow = {
  label: string;
  total: string;
  base: string;
  terror: string;
  esl: string;
  gst: string;
  sd: string;
  result: AdjustmentBreakdown["original"]["section1"];
  strong?: boolean;
};

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
