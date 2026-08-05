/**
 * Client-side CAR premium breakdown → Excel workbook.
 * Calculations on the Premium sheet are Excel formulas referencing Policy / Rates.
 *
 * Loaded via dynamic `import("exceljs")` only — never static-import into routes.
 */
import type {
  AdjustmentBreakdown,
  Policy,
  PolicyDocument,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";
import { getAppVersion } from "~/lib/app-version";
import { APP_NAME } from "~/lib/brand";
import { GST_RATE } from "~/lib/pricing/constants";
import { reviewDocumentsFingerprint } from "~/lib/services/policy/documents/fingerprints";
import {
  formatDocTimestamp,
  makeDoc,
  nextAmendmentNumber,
  nextDocumentId,
} from "~/lib/services/policy/documents/content";

export const PREMIUM_EXCEL_TEMPLATE_KEY = "premium-breakdown-xlsx";

/** Bump when Premium / Policy / Rates / Adjustment sheet layout or formulas change. */
export const PREMIUM_EXCEL_SPREADSHEET_VERSION = "1.0";

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const CURRENCY = '"$"#,##0.00';
const PERCENT = "0.0000%";

export function isPremiumExcelDocument(doc: PolicyDocument): boolean {
  return (
    doc.templateKey === PREMIUM_EXCEL_TEMPLATE_KEY ||
    /\.xlsx$/i.test(doc.filename)
  );
}

export function latestPremiumExcelDocument(
  documents: PolicyDocument[],
): PolicyDocument | undefined {
  return [...documents]
    .filter(isPremiumExcelDocument)
    .sort((a, b) => b.policyDocumentId - a.policyDocumentId)[0];
}

export function premiumExcelExportEnabled(
  documents: PolicyDocument[],
  fingerprint: string,
): boolean {
  const latest = latestPremiumExcelDocument(documents);
  if (!latest) return true;
  const base = latest.generationKey.split("|force|")[0] ?? latest.generationKey;
  return base !== fingerprint;
}

export function premiumExcelFingerprint(policy: Policy): string {
  return `excel|${reviewDocumentsFingerprint(policy)}`;
}

function coverTypeLabel(coverTypeId: number): string {
  if (coverTypeId === 2) return "Single";
  if (coverTypeId === 3) return "Owner Builder";
  return "Annual";
}

function liabilityBandLabel(band: number): string {
  if (band === 1) return "$10 Million";
  if (band === 2) return "$20 Million";
  if (band === 3) return "Not Insured";
  return String(band);
}

function stateCode(stateId: number): string {
  const map: Record<number, string> = {
    1: "ACT",
    2: "NSW",
    3: "NT",
    4: "QLD",
    5: "SA",
    6: "TAS",
    7: "VIC",
    8: "WA",
  };
  return map[stateId] ?? String(stateId);
}

function styleHeaderRow(row: import("exceljs").Row, cols: number) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, size: 11 };
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}

/** Round money formulas to cents so Excel totals match summed line items. */
function roundMoneyFormula(formula: string) {
  return `ROUND(${formula},2)`;
}

function moneyCell(cell: import("exceljs").Cell, formula?: string, value = 0) {
  if (formula) {
    cell.value = { formula: roundMoneyFormula(formula), result: value };
  } else {
    cell.value = value;
  }
  cell.numFmt = CURRENCY;
  cell.alignment = { horizontal: "right" };
}

function percentCell(cell: import("exceljs").Cell, value: number) {
  cell.value = value;
  cell.numFmt = PERCENT;
  cell.alignment = { horizontal: "right" };
}

export type BuildPremiumExcelInput = {
  policy: Policy;
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  adjustment?: AdjustmentBreakdown;
  generatedBy: string;
  appVersion?: string;
};

/** Build an .xlsx ArrayBuffer for the live policy premium snapshot. */
export async function buildPremiumExcelWorkbook(
  input: BuildPremiumExcelInput,
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = APP_NAME;
  workbook.created = new Date();
  workbook.modified = new Date();

  const { policy, premium, rating, adjustment } = input;
  const generatedAt = new Date();
  const version = input.appVersion ?? getAppVersion();
  const car = policy.car;
  const coverLabel = coverTypeLabel(car.coverTypeId);
  const turnoverLabel =
    car.coverTypeId === 2 || car.coverTypeId === 3
      ? "Project amount"
      : "Estimated turnover";

  // Sheet order: Premium first (filled after Policy/Rates exist for formulas).
  const sheet = workbook.addWorksheet("Premium");
  sheet.getColumn(1).width = 38;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 18;

  // ── Policy ──────────────────────────────────────────────────────────
  const inputs = workbook.addWorksheet("Policy");
  inputs.getColumn(1).width = 36;
  inputs.getColumn(2).width = 28;
  inputs.getColumn(3).width = 42;

  inputs.mergeCells("A1:B1");
  inputs.getCell("A1").value = "Policy";
  inputs.getCell("A1").font = { bold: true, size: 14 };

  const inputRows: Array<[string, string | number, string]> = [
    ["Policy number", policy.policyNumber, "text"],
    ["Insured name", car.insuredName || "", "text"],
    ["Cover type", coverLabel, "text"],
    ["Certificate / start date", policy.dateStart || "", "text"],
    ["End date", policy.dateEnd || "", "text"],
    [turnoverLabel, car.estimatedTurnover ?? 0, "money"],
    ["Contract works sum insured", car.contractWorksSumInsured ?? 0, "money"],
    ["Plant & equipment", car.plantEquipment ?? 0, "money"],
    ["Display homes (limits)", car.displayHomes ?? 0, "money"],
    ["Existing structure (limits)", car.existingStructure ?? 0, "money"],
    [
      "Display homes premium (manual)",
      premium.contractWorksDisplayHomesPremium ?? 0,
      "money",
    ],
    [
      "Existing structure premium (manual)",
      premium.contractWorksExistingStructurePremium ?? 0,
      "money",
    ],
    ["Broker fee (incl. GST)", premium.combinedBrokerFee ?? 0, "money"],
    ["Liability limit", liabilityBandLabel(car.liabilityLimitBand), "text"],
    ["State", stateCode(policy.stateId), "text"],
    ["Postcode", policy.postcode || "", "text"],
    ["Site address", car.siteAddress || "", "text"],
  ];

  // Row map (1-based data starts at row 3):
  // 3 policy#, 4 insured, 5 cover, 6 start, 7 end,
  // 8 turnover, 9 CW SI, 10 plant, 11 DH limits, 12 ES limits,
  // 13 DH prem, 14 ES prem, 15 broker, 16 liability, 17 state, 18 postcode, 19 site
  const INPUT = {
    turnover: "Policy!$B$8",
    plant: "Policy!$B$10",
    dhPremium: "Policy!$B$13",
    esPremium: "Policy!$B$14",
    brokerFee: "Policy!$B$15",
  } as const;

  inputs.getCell("A2").value = "Field";
  inputs.getCell("B2").value = "Value";
  inputs.getCell("C2").value = "Notes";
  styleHeaderRow(inputs.getRow(2), 3);

  inputRows.forEach(([label, value, kind], index) => {
    const row = 3 + index;
    inputs.getCell(`A${row}`).value = label;
    const cell = inputs.getCell(`B${row}`);
    if (kind === "money") {
      cell.value = Number(value) || 0;
      cell.numFmt = CURRENCY;
    } else {
      cell.value = value;
    }
  });
  inputs.getCell("C8").value = "Drives base premium (turnover × rate)";
  inputs.getCell("C13").value =
    "Broker-entered premium line (not rate-derived)";
  inputs.getCell("C14").value =
    "Broker-entered premium line (not rate-derived)";

  // ── Rates ───────────────────────────────────────────────────────────
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
  styleHeaderRow(rates.getRow(2), 3);

  const rateRows: Array<
    [string, number | string, string, "money" | "pct" | "text"]
  > = [
    [
      "Contract works applied rate",
      rating?.contractWorksAppliedRate ?? 0,
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
      rating?.liabilityAppliedRate ?? 0,
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
    ["ESL rate (construction)", rating?.eslRate ?? 0, "price_esl", "pct"],
    [
      "Plant ESL rate",
      rating?.plantEslRate ?? rating?.eslRate ?? 0,
      "price_esl",
      "pct",
    ],
    [
      "Stamp duty rate (section 1)",
      rating?.contractWorksStampDutyRate ?? 0,
      "price_stamp_duty",
      "pct",
    ],
    [
      "Stamp duty rate (section 2)",
      rating?.liabilityStampDutyRate ?? 0,
      "price_stamp_duty",
      "pct",
    ],
    [
      "Terrorism rate (τ)",
      rating?.terrorismRate ?? 0,
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

  // Row map starting at 3:
  // 3 cwRate, 4 cwMin, 5 llRate, 6 llMin, 7 plantRate, 8 esl, 9 plantEsl,
  // 10 sd1, 11 sd2, 12 terror, 13 tier, 14 gst, 15 plantMin, 16 plantMax
  const RATE = {
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
  } as const;

  rateRows.forEach(([label, value, note, kind], index) => {
    const row = 3 + index;
    rates.getCell(`A${row}`).value = label;
    const cell = rates.getCell(`B${row}`);
    if (kind === "pct") percentCell(cell, Number(value) || 0);
    else if (kind === "money") {
      cell.value = Number(value) || 0;
      cell.numFmt = CURRENCY;
    } else cell.value = value;
    rates.getCell(`C${row}`).value = note;
  });

  // ── Premium (formulas) ──────────────────────────────────────────────
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

  sheet.getCell("A8").value =
    "Amounts below are Excel formulas from Policy + Rates (not pasted totals).";
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

  // Data rows follow headerRow (Base … Total).
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

  const premRows: PremRow[] = [
    {
      label: "Base Premium",
      b: `${INPUT.turnover}*${RATE.cwRate}`,
      c: `${INPUT.turnover}*${RATE.llRate}`,
      d: `SUM(B${R.base}:C${R.base})`,
      bResult: premium.contractWorksCalculatedBasePremium,
      cResult: premium.liabilityCalculatedBasePremium,
      dResult:
        premium.contractWorksCalculatedBasePremium +
        premium.liabilityCalculatedBasePremium,
    },
    {
      label: "True Base Premium",
      b: `MAX(B${R.base},${RATE.cwMin})`,
      c: `MAX(C${R.base},${RATE.llMin})`,
      // Legacy combined true base (includes terror / plant / DH / ES)
      d: `SUM(B${R.trueBase},C${R.trueBase},B${R.terror},B${R.dh},B${R.es},B${R.plant},B${R.plantTerror})`,
      bResult: premium.contractWorksBasePremium,
      cResult: premium.liabilityBasePremium,
    },
    {
      label: "Terrorism Levy",
      b: `SUM(B${R.trueBase},B${R.dh},B${R.es})*${RATE.terror}`,
      bResult: premium.contractWorksTerrorismPremium,
    },
    {
      label: "Display Homes",
      b: INPUT.dhPremium,
      bResult: premium.contractWorksDisplayHomesPremium ?? 0,
    },
    {
      label: "Existing Structure",
      b: INPUT.esPremium,
      bResult: premium.contractWorksExistingStructurePremium ?? 0,
    },
    {
      label: "Plant and Equipment",
      b: `${INPUT.plant}*${RATE.plantRate}`,
      bResult: premium.contractWorksPlantPremium,
    },
    {
      label: "Terrorism Levy Plant and Equipment",
      b: `IF(B${R.plant}>0,B${R.plant}*${RATE.terror},0)`,
      bResult: premium.contractWorksPlantTerrorismPremium,
    },
    {
      label: "ESL Plant and Equipment",
      b: `IF(B${R.plant}>0,SUM(B${R.plant},B${R.plantTerror})*${RATE.plantEsl},0)`,
      bResult: premium.contractWorksPlantESL,
    },
    {
      label: "ESL",
      b: `SUM(B${R.trueBase},B${R.terror},B${R.dh},B${R.es})*${RATE.esl}`,
      c: `0`,
      d: `SUM(B${R.esl},C${R.esl},B${R.plantEsl})`,
      bResult: premium.contractWorksESL,
      cResult: premium.liabilityESL,
      dResult:
        premium.contractWorksESL +
        premium.liabilityESL +
        premium.contractWorksPlantESL,
    },
    {
      label: "GST",
      b: `SUM(B${R.trueBase}:B${R.esl})*${RATE.gst}`,
      c: `SUM(C${R.trueBase},C${R.esl})*${RATE.gst}`,
      d: `SUM(B${R.gst}:C${R.gst})`,
      bResult: premium.contractWorksGST,
      cResult: premium.liabilityGST,
      dResult: premium.contractWorksGST + premium.liabilityGST,
    },
    {
      label: "Stamp Duty",
      b: `SUM(B${R.trueBase}:B${R.gst})*${RATE.sd1}`,
      c: `SUM(C${R.trueBase},C${R.esl},C${R.gst})*${RATE.sd2}`,
      d: `SUM(B${R.sd}:C${R.sd})`,
      bResult: premium.contractWorksStampDuty,
      cResult: premium.liabilityStampDuty,
      dResult: premium.contractWorksStampDuty + premium.liabilityStampDuty,
    },
    {
      label: "Broker Fee",
      d: INPUT.brokerFee,
      dResult: premium.combinedBrokerFee,
    },
    {
      label: "Total Premium",
      b: `SUM(B${R.trueBase}:B${R.sd})`,
      c: `SUM(C${R.trueBase},C${R.esl}:C${R.sd})`,
      d: `SUM(B${R.total},C${R.total},D${R.broker})`,
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
    else sheet.getCell(`B${r}`).value = "";
    if (row.c) moneyCell(sheet.getCell(`C${r}`), row.c, row.cResult ?? 0);
    else sheet.getCell(`C${r}`).value = "";
    if (row.d) moneyCell(sheet.getCell(`D${r}`), row.d, row.dResult ?? 0);
    else if (row.b && row.c) {
      moneyCell(
        sheet.getCell(`D${r}`),
        `SUM(B${r}:C${r})`,
        (row.bResult ?? 0) + (row.cResult ?? 0),
      );
    } else if (row.b) {
      moneyCell(sheet.getCell(`D${r}`), `B${r}`, row.bResult ?? 0);
    } else sheet.getCell(`D${r}`).value = "";
  });

  const footnoteRow = R.total + 2;
  sheet.getCell(`A${footnoteRow}`).value =
    "Plant premium uses rate × plant value (v2.1+). Open Policy / Rates to change drivers; Premium recalculates via formulas.";
  sheet.mergeCells(`A${footnoteRow}:D${footnoteRow}`);
  sheet.getCell(`A${footnoteRow}`).font = {
    size: 9,
    color: { argb: "FF6B7280" },
    italic: true,
  };

  // ── Adjustment (optional) ───────────────────────────────────────────
  if (adjustment) {
    const adj = workbook.addWorksheet("Adjustment");
    adj.getColumn(1).width = 28;
    adj.getColumn(2).width = 16;
    adj.getColumn(3).width = 16;
    adj.getColumn(4).width = 16;
    adj.getColumn(5).width = 16;
    adj.getColumn(6).width = 16;
    adj.getColumn(7).width = 16;

    adj.mergeCells("A1:G1");
    adj.getCell("A1").value = "End-of-term adjustment";
    adj.getCell("A1").font = { bold: true, size: 14 };

    adj.getCell("A2").value = "Original turnover";
    moneyCell(adj.getCell("B2"), undefined, adjustment.originalTurnover);
    adj.getCell("C2").value = "Adjusted turnover";
    moneyCell(adj.getCell("D2"), undefined, adjustment.adjustmentTurnover);
    adj.getCell("E2").value = "Stamp duty";
    adj.getCell("F2").value = adjustment.stampDutyExempt ? "Exempt" : "Liable";

    const blocks: Array<{
      title: string;
      data: AdjustmentBreakdown["original"];
    }> = [
      { title: "Original (at bind)", data: adjustment.original },
      { title: "Absolute at adjusted turnover", data: adjustment.adjustment },
      { title: "Delta (adjustment premium)", data: adjustment.delta },
    ];

    let start = 4;
    for (const block of blocks) {
      adj.mergeCells(`A${start}:G${start}`);
      adj.getCell(`A${start}`).value = block.title;
      adj.getCell(`A${start}`).font = { bold: true };

      const head = start + 1;
      const headers = [
        "Section",
        "True base",
        "Terrorism",
        "ESL",
        "GST",
        "Stamp duty",
        "Total",
      ];
      headers.forEach((h, i) => {
        adj.getCell(head, i + 1).value = h;
      });
      styleHeaderRow(adj.getRow(head), 7);

      const s1 = head + 1;
      const s2 = head + 2;
      const tot = head + 3;

      const sections: Array<
        [string, AdjustmentBreakdown["original"]["section1"], number]
      > = [
        ["Section 1 — Contract works", block.data.section1, s1],
        ["Section 2 — Legal liability", block.data.section2, s2],
        ["Total", block.data.total, tot],
      ];

      sections.forEach(([label, row, r]) => {
        adj.getCell(`A${r}`).value = label;
        if (label === "Total") {
          adj.getCell(`A${r}`).font = { bold: true };
          moneyCell(
            adj.getCell(`B${r}`),
            `SUM(B${s1}:B${s2})`,
            row.trueBasePremium,
          );
          moneyCell(
            adj.getCell(`C${r}`),
            `SUM(C${s1}:C${s2})`,
            row.terrorismPremium,
          );
          moneyCell(adj.getCell(`D${r}`), `SUM(D${s1}:D${s2})`, row.esl);
          moneyCell(adj.getCell(`E${r}`), `SUM(E${s1}:E${s2})`, row.gst);
          moneyCell(adj.getCell(`F${r}`), `SUM(F${s1}:F${s2})`, row.sd);
          moneyCell(
            adj.getCell(`G${r}`),
            `SUM(G${s1}:G${s2})`,
            row.totalPremium,
          );
          for (const col of ["B", "C", "D", "E", "F", "G"] as const) {
            adj.getCell(`${col}${r}`).font = { bold: true };
          }
        } else {
          moneyCell(adj.getCell(`B${r}`), undefined, row.trueBasePremium);
          moneyCell(adj.getCell(`C${r}`), undefined, row.terrorismPremium);
          moneyCell(adj.getCell(`D${r}`), undefined, row.esl);
          moneyCell(adj.getCell(`E${r}`), undefined, row.gst);
          moneyCell(adj.getCell(`F${r}`), undefined, row.sd);
          moneyCell(adj.getCell(`G${r}`), `SUM(B${r}:F${r})`, row.totalPremium);
        }
      });

      start = tot + 2;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function buildPremiumExcelDocument(options: {
  policy: Policy;
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  generatedBy: string;
  existing: PolicyDocument[];
}): Promise<PolicyDocument> {
  const { policy, premium, rating, generatedBy, existing } = options;
  const bytes = await buildPremiumExcelWorkbook({
    policy,
    premium,
    rating,
    adjustment: policy.car.adjusted
      ? policy.car.adjustment?.breakdown
      : undefined,
    generatedBy,
  });
  const when = new Date();
  const stamp = formatDocTimestamp(when);
  const amendment = nextAmendmentNumber(existing, PREMIUM_EXCEL_TEMPLATE_KEY);
  const filename =
    amendment > 0
      ? `${policy.policyNumber}_Premium_${stamp}_A${amendment}.xlsx`
      : `${policy.policyNumber}_Premium_${stamp}.xlsx`;

  return {
    ...makeDoc({
      id: nextDocumentId(existing),
      policyId: policy.policyId,
      name: "Premium Excel",
      filename,
      generationKey: premiumExcelFingerprint(policy),
      content: `CAR premium breakdown spreadsheet v${PREMIUM_EXCEL_SPREADSHEET_VERSION} (formula-driven)`,
      generatedBy,
      generatedWhen: when.toISOString(),
      templateKey: PREMIUM_EXCEL_TEMPLATE_KEY,
    }),
    pdfBase64: uint8ToBase64(bytes),
  };
}

/** Trigger a browser download from a stored excel PolicyDocument. */
export function downloadPremiumExcelDocument(doc: PolicyDocument) {
  if (!doc.pdfBase64) {
    throw new Error("Excel file is not available on this document");
  }
  const binary = atob(doc.pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = doc.filename.endsWith(".xlsx")
    ? doc.filename
    : `${doc.filename}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
