/**
 * Plant equipment premium calculation logic.
 * Extracted from premium-workings.ts to reduce file size.
 */

import {
  PLANT_CERTIFICATE_TURNOVER_LIMIT,
  TERROR_START_DATE,
  VERSION_21_START_DATE,
} from "~/constants";
import { formatCurrency, formatRate } from "~/lib/utils";
import { roundMoney, step } from "./premium-utils";
import type { PremiumWorkingStep } from "./premium-workings";

export interface PlantPremiumInputs {
  certificateDate: string;
  plantEquipment: number;
  contractWorksSumInsured: number;
  plantRate: number;
  plantValueMin: number;
  plantValueMax: number;
}

export interface PlantPremiumResult {
  value: number;
  steps: PremiumWorkingStep[];
}

/**
 * Calculate plant equipment premium based on certificate date and plant value.
 * Handles multiple scenarios:
 * 1. Post-VERSION_21_START_DATE (2023-01-01): Simple rate × value
 * 2. Pre-terror or low turnover: Banded calculation with min/max
 * 3. Post-terror with high turnover: Capped at max value
 */
export function plantPremium({
  certificateDate,
  plantEquipment,
  contractWorksSumInsured,
  plantRate,
  plantValueMin,
  plantValueMax,
}: PlantPremiumInputs): PlantPremiumResult {
  if (plantEquipment <= 0 || plantRate <= 0) {
    return {
      value: 0,
      steps: [
        step("Plant equipment value", formatCurrency(plantEquipment)),
        step("Result", formatCurrency(0)),
      ],
    };
  }

  // Rule 1: Certificate date >= 2023-01-01 (VERSION_21_START_DATE)
  if (certificateDate >= VERSION_21_START_DATE) {
    const value = roundMoney(plantRate * plantEquipment);
    return {
      value,
      steps: [
        step("Rule", "Certificate date ≥ 2023-01-01"),
        step(
          "Plant rate × plant value",
          `${formatRate(plantRate)} × ${formatCurrency(plantEquipment)}`,
        ),
        step("Result", formatCurrency(value)),
      ],
    };
  }

  // Rule 2: Pre-terror certificate or low contract works sum insured
  if (
    certificateDate < TERROR_START_DATE ||
    contractWorksSumInsured <= PLANT_CERTIFICATE_TURNOVER_LIMIT
  ) {
    // Banded plant calculation with first band free
    if (plantEquipment <= plantValueMin) {
      return {
        value: 0,
        steps: [
          step("Rule", "Banded plant — first band free"),
          step(
            "Plant ≤ min",
            `${formatCurrency(plantEquipment)} ≤ ${formatCurrency(plantValueMin)}`,
          ),
          step("Result", formatCurrency(0)),
        ],
      };
    }

    if (plantEquipment > plantValueMax) {
      const value = roundMoney(plantRate * (plantValueMax - plantValueMin));
      return {
        value,
        steps: [
          step("Rule", "Banded plant — capped at max band"),
          step(
            "Plant rate × (max − min)",
            `${formatRate(plantRate)} × (${formatCurrency(plantValueMax)} − ${formatCurrency(plantValueMin)})`,
          ),
          step("Result", formatCurrency(value)),
        ],
      };
    }

    const value = roundMoney(plantRate * (plantEquipment - plantValueMin));
    return {
      value,
      steps: [
        step("Rule", "Banded plant — first band free"),
        step(
          "Plant rate × (plant − min)",
          `${formatRate(plantRate)} × (${formatCurrency(plantEquipment)} − ${formatCurrency(plantValueMin)})`,
        ),
        step("Result", formatCurrency(value)),
      ],
    };
  }

  // Rule 3: Post-terror certificate with high turnover
  if (plantEquipment > plantValueMax) {
    const value = roundMoney(plantRate * plantValueMax);
    return {
      value,
      steps: [
        step("Rule", "Post-terror, CW > $2.5M — capped at max"),
        step(
          "Plant rate × max",
          `${formatRate(plantRate)} × ${formatCurrency(plantValueMax)}`,
        ),
        step("Result", formatCurrency(value)),
      ],
    };
  }

  const value = roundMoney(plantRate * plantEquipment);
  return {
    value,
    steps: [
      step("Rule", "Post-terror, CW > $2.5M"),
      step(
        "Plant rate × plant value",
        `${formatRate(plantRate)} × ${formatCurrency(plantEquipment)}`,
      ),
      step("Result", formatCurrency(value)),
    ],
  };
}

/**
 * Determine if plant premium calculation applies based on certificate date.
 */
export function isPlantPremiumApplicable(certificateDate: string): boolean {
  return certificateDate >= VERSION_21_START_DATE;
}

/**
 * Get plant premium calculation rule description based on inputs.
 */
export function getPlantPremiumRuleDescription({
  certificateDate,
  contractWorksSumInsured,
}: {
  certificateDate: string;
  contractWorksSumInsured: number;
}): string {
  if (certificateDate >= VERSION_21_START_DATE) {
    return "Certificate date ≥ 2023-01-01";
  }

  if (
    certificateDate < TERROR_START_DATE ||
    contractWorksSumInsured <= PLANT_CERTIFICATE_TURNOVER_LIMIT
  ) {
    return "Banded plant calculation with first band free";
  }

  return "Post-terror, contract works > $2.5M";
}
