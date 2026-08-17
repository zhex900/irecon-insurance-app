import { memo, useCallback } from "react";

import { PolicyCollapsibleSection } from "~/components/policies/policy-form-layout";
import type {
  AdjustmentBreakdown,
  PremiumBreakdown,
  RatingSnapshot,
  ReferenceData,
} from "~/lib/db/types";

import { PremiumDeclaration } from "../sections/premium-declaration";
import { SECTION_IDS } from "../shared/constants";

export type PremiumSectionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borderClassName: string;
  premium: PremiumBreakdown | undefined;
  premiumRef: React.RefObject<PremiumBreakdown | undefined>;
  premiumManuallyEditedRef: React.RefObject<boolean>;
  premiumManualKeysRef: React.RefObject<string[]>;
  setPremiumManualKeys: (keys: string[]) => void;
  setPremium: (premium: PremiumBreakdown | undefined) => void;
  hasUnsavedChangesRef: React.RefObject<boolean>;
  setHasUnsavedChanges: (value: boolean) => void;
  persistDraft: (options?: {
    force?: boolean;
    skipPremiumRefresh?: boolean;
  }) => Promise<boolean>;
  fieldsLocked: boolean;
  reference: ReferenceData;
  rating: RatingSnapshot | undefined;
  initialManualKeys: string[] | undefined;
  resetManualPremium: () => void;
  isCalculating: boolean;
  exportPremiumExcel: () => Promise<void>;
  isExportingExcel: boolean;
  adjustmentBreakdown: AdjustmentBreakdown | undefined;
};

export const PremiumSection = memo(function PremiumSection({
  open,
  onOpenChange,
  borderClassName,
  premium,
  premiumRef,
  premiumManuallyEditedRef,
  premiumManualKeysRef,
  setPremiumManualKeys,
  setPremium,
  hasUnsavedChangesRef,
  setHasUnsavedChanges,
  persistDraft,
  fieldsLocked,
  reference,
  rating,
  initialManualKeys,
  resetManualPremium,
  isCalculating,
  exportPremiumExcel,
  isExportingExcel,
  adjustmentBreakdown,
}: PremiumSectionProps) {
  const onPremiumChange = useCallback(
    (next: PremiumBreakdown | undefined) => {
      premiumManuallyEditedRef.current = true;
      premiumRef.current = next;
      setPremium(next);
      hasUnsavedChangesRef.current = true;
      setHasUnsavedChanges(true);
      void persistDraft({ force: true, skipPremiumRefresh: true });
    },
    [
      hasUnsavedChangesRef,
      persistDraft,
      premiumManuallyEditedRef,
      premiumRef,
      setHasUnsavedChanges,
      setPremium,
    ],
  );

  const onManualKeysChange = useCallback(
    (keys: string[]) => {
      premiumManualKeysRef.current = keys;
      setPremiumManualKeys(keys);
    },
    [premiumManualKeysRef, setPremiumManualKeys],
  );

  return (
    <PolicyCollapsibleSection
      id={SECTION_IDS.PREMIUM}
      title="Premium"
      description="Premium breakdown and confirmation"
      open={open}
      onOpenChange={onOpenChange}
      className={borderClassName}
    >
      <PremiumDeclaration
        premium={premium}
        reference={reference}
        rating={rating}
        initialManualKeys={initialManualKeys}
        premiumEditable={!fieldsLocked}
        onPremiumChange={fieldsLocked ? undefined : onPremiumChange}
        onManualKeysChange={fieldsLocked ? undefined : onManualKeysChange}
        onResetPremium={fieldsLocked ? undefined : resetManualPremium}
        isCalculating={isCalculating}
        onExportExcel={exportPremiumExcel}
        isExportingExcel={isExportingExcel}
        adjustmentBreakdown={adjustmentBreakdown}
      />
    </PolicyCollapsibleSection>
  );
});
