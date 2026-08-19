import { useEffect } from "react";
import { type FieldPath, type UseFormReturn } from "react-hook-form";

import type { PremiumBreakdown } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import { pricingFields } from "~/lib/zod/policy-car";

import { createDraftSnapshot } from "./use-draft-utils";

export function useDraftFieldWatching({
  form,
  premiumRef,
  premiumManualKeysRef,
  premiumManuallyEditedRef,
  savedSnapshotRef,
  setHasUnsavedChanges,
}: {
  form: UseFormReturn<CarPolicyFormValues>;
  premiumRef: React.RefObject<PremiumBreakdown | undefined>;
  premiumManualKeysRef: React.RefObject<string[]>;
  premiumManuallyEditedRef: React.RefObject<boolean>;
  savedSnapshotRef: React.RefObject<string>;
  setHasUnsavedChanges: (value: boolean | ((prev: boolean) => boolean)) => void;
}) {
  // Keep local unsaved flag in sync with edits (no reliance on RHF isDirty/reset).
  // Re-validate fields that already show errors as the user updates them.
  useEffect(() => {
    const pricingRoots = new Set<string>(pricingFields);
    const subscription = form.watch((values, info) => {
      const name = info.name;
      const root = name?.split(".")[0] ?? "";

      // Only real value edits clear the manual-premium guard. Validation /
      // trigger callbacks must not — otherwise a premium-breakdown save can
      // race into a server recalculate that wipes ES/DH-folded terrorism.
      if (root && pricingRoots.has(root) && info.type === "change") {
        premiumManuallyEditedRef.current = false;
      }

      if (name) {
        const { error } = form.getFieldState(
          name as FieldPath<CarPolicyFormValues>,
        );
        if (error) {
          void form.trigger(name as FieldPath<CarPolicyFormValues>);
        }
      }

      const snapshot = createDraftSnapshot(
        values as CarPolicyFormValues,
        premiumRef.current,
        premiumManualKeysRef.current,
      );
      const dirty = snapshot !== savedSnapshotRef.current;
      setHasUnsavedChanges((prev: boolean) => (prev === dirty ? prev : dirty));
    });

    return () => subscription.unsubscribe();
  }, [
    form,
    premiumRef,
    premiumManualKeysRef,
    premiumManuallyEditedRef,
    savedSnapshotRef,
    setHasUnsavedChanges,
  ]);
}
