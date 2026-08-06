import { APP_NAME } from "~/lib/brand";
import {
  setMoneyCell as moneyCell,
  styleWorkbookHeaderRow as styleHeaderRow,
} from "~/lib/pricing/premium-excel-workbook";
import {
  PREMIUM_EXCEL_SPREADSHEET_VERSION,
  type PremiumExcelPolicyRefs,
  type PremiumExcelRateRefs,
  type PremiumExcelSheetContext,
} from "~/lib/pricing/premium-excel-types";

type PremRow = {
  label: string;
  b?: string;
  c?: string;
  d?: string;
  bResult?: number;
  cResult?: number;
  dResult?: number;
  strong?: boolean;
};

export function addPremiumExcelPremiumSheet(
  sheet: import("exceljs").Worksheet,
  ctx: PremiumExcelSheetContext,
  INPUT: PremiumExcelPolicyRefs,
  RATE: PremiumExcelRateRefs,
) {
  const { policy, premium, coverLabel, turnoverLabel, generatedAt, version } =
    ctx;
  const car = policy.car;
  // Click-edited Premium Breakdown lines must ship as values. Rate formulas
  // would overwrite the broker's numbers when Excel recalculates on open.
  const pasteManualValues = (car.premiumManualKeys?.length ?? 0) > 0;

  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = APP_NAME;
  sheet.getCell("A1").font = { bold: true, size: 18 };

  sheet.mergeCells("A2:D2");
  sheet.getCell("A2").value = "Premium Breakdown";
  sheet.getCell("A2").font = { bold: true, size: 14 };

  sheet.getCell("A3").value = "Generated";
  sheet.getCell("B3").value = generatedAt.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  sheet.getCell("C3").value = "Spreadsheet version";
  sheet.getCell("D3").value = PREMIUM_EXCEL_SPREADSHEET_VERSION;

  sheet.getCell("A4").value = "App version";
  sheet.getCell("B4").value = version;

  sheet.getCell("A5").value = "Policy number";
  sheet.getCell("B5").value = policy.policyNumber;
  sheet.getCell("C5").value = "Insured";
  sheet.getCell("D5").value = car.insuredName || "—";

  sheet.getCell("A6").value = "Cover type";
  sheet.getCell("B6").value = coverLabel;
  sheet.getCell("C6").value = turnoverLabel;
  moneyCell(sheet.getCell("D6"), undefined, car.estimatedTurnover ?? 0);

  sheet.getCell("A7").value = "Site";
  sheet.mergeCells("B7:D7");
  sheet.getCell("B7").value = car.siteAddress || "—";

  sheet.getCell("A8").value = pasteManualValues
    ? "Amounts below match the Premium Breakdown (including manual edits)."
    : "Amounts below are Excel formulas from Policy + Rates (not pasted totals).";
  sheet.mergeCells("A8:D8");
  sheet.getCell("A8").font = {
    italic: true,
    size: 9,
    color: { argb: "FF6B7280" },
  };

  const headerRow = 10;
  sheet.getCell(`A${headerRow}`).value = "Component";
  sheet.getCell(`B${headerRow}`).value = "Contract works";
  sheet.getCell(`C${headerRow}`).value = "Legal liability";
  sheet.getCell(`D${headerRow}`).value = "Combined";
  styleHeaderRow(sheet.getRow(headerRow), 4);
  sheet.getRow(headerRow).alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  sheet.getCell(`A${headerRow}`).alignment = {
    horizontal: "left",
    vertical: "middle",
  };

  const R = {
    base: headerRow + 1,
    trueBase: headerRow + 2,
    terror: headerRow + 3,
    dh: headerRow + 4,
    es: headerRow + 5,
    plant: headerRow + 6,
    plantTerror: headerRow + 7,
    plantEsl: headerRow + 8,
    esl: headerRow + 9,
    gst: headerRow + 10,
    sd: headerRow + 11,
    broker: headerRow + 12,
    total: headerRow + 13,
  } as const;

  const formulaUnlessManual = (formula: string) =>
    pasteManualValues ? undefined : formula;

  const premRows: PremRow[] = [
    {
      label: "Base Premium",
      b: formulaUnlessManual(`${INPUT.turnover}*${RATE.cwRate}`),
      c: formulaUnlessManual(`${INPUT.turnover}*${RATE.llRate}`),
      d: formulaUnlessManual(`SUM(B${R.base}:C${R.base})`),
      bResult: premium.contractWorksCalculatedBasePremium,
      cResult: premium.liabilityCalculatedBasePremium,
      dResult:
        premium.contractWorksCalculatedBasePremium +
        premium.liabilityCalculatedBasePremium,
    },
    {
      label: "True Base Premium",
      b: formulaUnlessManual(`MAX(B${R.base},${RATE.cwMin})`),
      c: formulaUnlessManual(`MAX(C${R.base},${RATE.llMin})`),
      d: formulaUnlessManual(
        `SUM(B${R.trueBase},C${R.trueBase},B${R.terror},B${R.dh},B${R.es},B${R.plant},B${R.plantTerror})`,
      ),
      bResult: premium.contractWorksBasePremium,
      cResult: premium.liabilityBasePremium,
      dResult:
        premium.contractWorksBasePremium +
        premium.liabilityBasePremium +
        premium.contractWorksTerrorismPremium +
        (premium.contractWorksDisplayHomesPremium ?? 0) +
        (premium.contractWorksExistingStructurePremium ?? 0) +
        premium.contractWorksPlantPremium +
        premium.contractWorksPlantTerrorismPremium,
    },
    {
      label: "Terrorism Levy",
      b: formulaUnlessManual(
        `SUM(B${R.trueBase},B${R.dh},B${R.es})*${RATE.terror}`,
      ),
      bResult: premium.contractWorksTerrorismPremium,
    },
    {
      label: "Display Homes",
      b: formulaUnlessManual(INPUT.dhPremium),
      bResult: premium.contractWorksDisplayHomesPremium ?? 0,
    },
    {
      label: "Existing Structure",
      b: formulaUnlessManual(INPUT.esPremium),
      bResult: premium.contractWorksExistingStructurePremium ?? 0,
    },
    {
      label: "Plant and Equipment",
      b: formulaUnlessManual(`${INPUT.plant}*${RATE.plantRate}`),
      bResult: premium.contractWorksPlantPremium,
    },
    {
      label: "Terrorism Levy Plant and Equipment",
      b: formulaUnlessManual(`IF(B${R.plant}>0,B${R.plant}*${RATE.terror},0)`),
      bResult: premium.contractWorksPlantTerrorismPremium,
    },
    {
      label: "ESL Plant and Equipment",
      b: formulaUnlessManual(
        `IF(B${R.plant}>0,SUM(B${R.plant},B${R.plantTerror})*${RATE.plantEsl},0)`,
      ),
      bResult: premium.contractWorksPlantESL,
    },
    {
      label: "ESL",
      b: formulaUnlessManual(
        `SUM(B${R.trueBase},B${R.terror},B${R.dh},B${R.es})*${RATE.esl}`,
      ),
      c: formulaUnlessManual(`0`),
      d: formulaUnlessManual(`SUM(B${R.esl},C${R.esl},B${R.plantEsl})`),
      bResult: premium.contractWorksESL,
      cResult: premium.liabilityESL,
      dResult:
        premium.contractWorksESL +
        premium.liabilityESL +
        premium.contractWorksPlantESL,
    },
    {
      label: "GST",
      b: formulaUnlessManual(`SUM(B${R.trueBase}:B${R.esl})*${RATE.gst}`),
      c: formulaUnlessManual(`SUM(C${R.trueBase},C${R.esl})*${RATE.gst}`),
      d: formulaUnlessManual(`SUM(B${R.gst}:C${R.gst})`),
      bResult: premium.contractWorksGST,
      cResult: premium.liabilityGST,
      dResult: premium.contractWorksGST + premium.liabilityGST,
    },
    {
      label: "Stamp Duty",
      b: formulaUnlessManual(`SUM(B${R.trueBase}:B${R.gst})*${RATE.sd1}`),
      c: formulaUnlessManual(
        `SUM(C${R.trueBase},C${R.esl},C${R.gst})*${RATE.sd2}`,
      ),
      d: formulaUnlessManual(`SUM(B${R.sd}:C${R.sd})`),
      bResult: premium.contractWorksStampDuty,
      cResult: premium.liabilityStampDuty,
      dResult: premium.contractWorksStampDuty + premium.liabilityStampDuty,
    },
    {
      label: "Broker Fee",
      d: formulaUnlessManual(INPUT.brokerFee),
      dResult: premium.combinedBrokerFee,
    },
    {
      label: "Total Premium",
      b: formulaUnlessManual(`SUM(B${R.trueBase}:B${R.sd})`),
      c: formulaUnlessManual(`SUM(C${R.trueBase},C${R.esl}:C${R.sd})`),
      d: formulaUnlessManual(`SUM(B${R.total},C${R.total},D${R.broker})`),
      bResult: premium.contractWorksTotalPremium,
      cResult: premium.liabilityTotalPremium,
      dResult: premium.originalTotalPremium,
      strong: true,
    },
  ];

  premRows.forEach((row, index) => {
    const r = headerRow + 1 + index;
    const labelCell = sheet.getCell(`A${r}`);
    labelCell.value = row.label;
    if (row.strong) labelCell.font = { bold: true };
    if (row.b) moneyCell(sheet.getCell(`B${r}`), row.b, row.bResult ?? 0);
    else if (row.bResult != null)
      moneyCell(sheet.getCell(`B${r}`), undefined, row.bResult);
    else sheet.getCell(`B${r}`).value = "";
    if (row.c) moneyCell(sheet.getCell(`C${r}`), row.c, row.cResult ?? 0);
    else if (row.cResult != null)
      moneyCell(sheet.getCell(`C${r}`), undefined, row.cResult);
    else sheet.getCell(`C${r}`).value = "";
    if (row.d) moneyCell(sheet.getCell(`D${r}`), row.d, row.dResult ?? 0);
    else if (row.dResult != null)
      moneyCell(sheet.getCell(`D${r}`), undefined, row.dResult);
    else if (row.b && row.c) {
      moneyCell(
        sheet.getCell(`D${r}`),
        `SUM(B${r}:C${r})`,
        (row.bResult ?? 0) + (row.cResult ?? 0),
      );
    } else if (row.b) {
      moneyCell(sheet.getCell(`D${r}`), `B${r}`, row.bResult ?? 0);
    } else if (row.bResult != null || row.cResult != null) {
      moneyCell(
        sheet.getCell(`D${r}`),
        undefined,
        (row.bResult ?? 0) + (row.cResult ?? 0),
      );
    } else sheet.getCell(`D${r}`).value = "";
  });

  const footnoteRow = R.total + 2;
  sheet.getCell(`A${footnoteRow}`).value = pasteManualValues
    ? "Manual Premium Breakdown edits are pasted as values so Excel matches the policy UI."
    : "Plant premium uses rate × plant value (v2.1+). Open Policy / Rates to change drivers; Premium recalculates via formulas.";
  sheet.mergeCells(`A${footnoteRow}:D${footnoteRow}`);
  sheet.getCell(`A${footnoteRow}`).font = {
    size: 9,
    color: { argb: "FF6B7280" },
    italic: true,
  };
}
