import {
  formatCurrencyCell,
  styleWorkbookHeaderRow as styleHeaderRow,
} from "~/lib/pricing/premium-excel-workbook";
import {
  liabilityBandLabel,
  stateCode,
} from "~/lib/pricing/premium-excel-labels";
import type {
  PremiumExcelPolicyRefs,
  PremiumExcelSheetContext,
} from "~/lib/pricing/premium-excel-types";

export function addPremiumExcelPolicySheet(
  workbook: import("exceljs").Workbook,
  ctx: PremiumExcelSheetContext,
): PremiumExcelPolicyRefs {
  const { policy, premium, adjustment, coverLabel, turnoverLabel } = ctx;
  const car = policy.car;

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
  if (adjustment) {
    inputRows.push(
      ["Adjustment turnover", adjustment.adjustmentTurnover, "money"],
      ["Stamp duty exempt", adjustment.stampDutyExempt ? "Yes" : "No", "text"],
      ["Bind CW true base premium", premium.contractWorksBasePremium, "money"],
      [
        "Bind CW terrorism levy",
        premium.contractWorksTerrorismPremium,
        "money",
      ],
      ["Bind LL true base premium", premium.liabilityBasePremium, "money"],
      ["Bind CW ESL", premium.contractWorksESL, "money"],
      ["Bind CW GST", premium.contractWorksGST, "money"],
      ["Bind CW stamp duty", premium.contractWorksStampDuty, "money"],
      ["Bind LL ESL", premium.liabilityESL, "money"],
      ["Bind LL GST", premium.liabilityGST, "money"],
      ["Bind LL stamp duty", premium.liabilityStampDuty, "money"],
      [
        "Bind CW base (calculated)",
        premium.contractWorksCalculatedBasePremium,
        "money",
      ],
      [
        "Bind LL base (calculated)",
        premium.liabilityCalculatedBasePremium,
        "money",
      ],
      ["Bind CW plant", premium.contractWorksPlantPremium, "money"],
      [
        "Bind CW plant terrorism",
        premium.contractWorksPlantTerrorismPremium,
        "money",
      ],
      ["Bind CW plant ESL", premium.contractWorksPlantESL, "money"],
    );
  }

  const INPUT: PremiumExcelPolicyRefs = {
    turnover: "Policy!$B$8",
    plant: "Policy!$B$10",
    dhPremium: "Policy!$B$13",
    esPremium: "Policy!$B$14",
    brokerFee: "Policy!$B$15",
    adjTurnover: "Policy!$B$20",
    sdExempt: "Policy!$B$21",
    bindCwTrue: "Policy!$B$22",
    bindCwTerror: "Policy!$B$23",
    bindLlTrue: "Policy!$B$24",
    bindCwEsl: "Policy!$B$25",
    bindCwGst: "Policy!$B$26",
    bindCwSd: "Policy!$B$27",
    bindLlEsl: "Policy!$B$28",
    bindLlGst: "Policy!$B$29",
    bindLlSd: "Policy!$B$30",
    bindCwBase: "Policy!$B$31",
    bindLlBase: "Policy!$B$32",
    bindCwPlant: "Policy!$B$33",
    bindCwPlantTerror: "Policy!$B$34",
    bindCwPlantEsl: "Policy!$B$35",
  };

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
      formatCurrencyCell(cell);
    } else {
      cell.value = value;
    }
  });
  inputs.getCell("C8").value = "Original / estimated turnover (bind)";
  inputs.getCell("C13").value =
    "Broker-entered premium line (not rate-derived)";
  inputs.getCell("C14").value =
    "Broker-entered premium line (not rate-derived)";
  if (adjustment) {
    inputs.getCell("C20").value = "End-of-term adjustment turnover";
    inputs.getCell("C21").value = "Yes → Section 2 stamp duty is zero";
    inputs.getCell("C22").value = "Stored bind premium (adjust original)";
  }

  return INPUT;
}
