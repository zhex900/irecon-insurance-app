import type { RefObject } from "react";
import type { Blocker, NavigateFunction } from "react-router";
import type { UseFormReturn } from "react-hook-form";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export type PolicyLeaveApi = {
  blocker: Blocker;
  allowLeaveRef: RefObject<boolean>;
  pendingLeaveAfterSaveRef: RefObject<boolean>;
  pendingLeaveDestinationRef: RefObject<string | null>;
  setPendingLeaveAfterSave: (value: boolean) => void;
  setDiscardConfirmOpen: (value: boolean) => void;
};

export interface UseDraftSaveProps {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  premiumRef: RefObject<PremiumBreakdown | undefined>;
  premiumManuallyEditedRef: RefObject<boolean>;
  premiumManualKeysRef: RefObject<string[]>;
  getDirtyPaths: () => string[];
  commitSavedPaths: (paths: string[]) => void;
  rollbackSavedPaths: (paths: string[]) => void;
  refreshPremiumAfterSave: (dirtyPaths: string[]) => void;
  getLeaveApi: () => PolicyLeaveApi | null;
  navigate: NavigateFunction;
}
