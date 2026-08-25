import { annualNotTakenScenario } from "./annual-not-taken";
import { annualTakenScenario } from "./annual-taken";

export type {
  PolicyMatrixScenario,
  PremiumBreakdownExpected,
  PremiumMatrixExpected,
} from "./types";

export const policyMatrixScenarios = [
  annualNotTakenScenario,
  annualTakenScenario,
];
