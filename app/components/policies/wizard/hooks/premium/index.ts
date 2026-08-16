// Premium subsystem exports
export * from "./use-premium-calculation";
export * from "./use-premium-utils";
export * from "./use-premium-state-management";
export * from "./use-premium-actions";
export * from "./use-premium-auto-calculation";
export * from "./use-premium-referral-reasons";

// Re-export composite hooks that belong to this domain
export { usePolicyPremiumCalc } from "../composite/use-premium-calc";
