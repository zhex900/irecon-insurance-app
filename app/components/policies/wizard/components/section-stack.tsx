import type { Dispatch, RefObject, SetStateAction } from "react";

import { PolicyCollapsibleSection } from "~/components/policies/policy-form-layout";
import type {
  CarWording,
  Policy,
  PremiumBreakdown,
  ReferenceData,
} from "~/lib/db/types";

import { useMode } from "../hooks/utils/use-mode";
import { ClaimsWording } from "../sections/claims-wording";
import { Excesses } from "../sections/excesses";
import { Limits } from "../sections/limits";
import { PremiumDeclaration } from "../sections/premium-declaration";
import { RiskDetails } from "../sections/risk-details";
import { SECTION_IDS } from "../shared/constants";

export type WizardSectionStackProps = {
  openMap: Record<string, boolean>;
  setOpenMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  reference: ReferenceData;
  carWording: CarWording[];
  premium: PremiumBreakdown | undefined;
  referralReasons: string[];
  notes: Policy["notes"];
  policy: Policy;
  /** Latest rating snapshot (fetcher may be newer than policy.car.rating). */
  rating?: Policy["car"]["rating"];
  premiumManuallyEditedRef: RefObject<boolean>;
  premiumManualKeysRef: RefObject<string[]>;
  premiumRef: RefObject<PremiumBreakdown | undefined>;
  setPremium: Dispatch<SetStateAction<PremiumBreakdown | undefined>>;
  hasUnsavedChangesRef: RefObject<boolean>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  persistDraft: (opts?: {
    force?: boolean;
    skipPremiumRefresh?: boolean;
  }) => Promise<unknown>;
  handleFieldBlur: () => void;
  onResetPremium?: () => void;
  isCalculating?: boolean;
  onExportExcel?: () => void;
  isExportingExcel?: boolean;
  shellCardClassName?: string;
};

export function SectionStack({
  openMap,
  setOpenMap,
  reference,
  carWording,
  premium,
  referralReasons,
  notes,
  policy,
  rating,
  premiumManuallyEditedRef,
  premiumManualKeysRef,
  premiumRef,
  setPremium,
  hasUnsavedChangesRef,
  setHasUnsavedChanges,
  persistDraft,
  handleFieldBlur,
  onResetPremium,
  isCalculating = false,
  onExportExcel,
  isExportingExcel = false,
  shellCardClassName,
}: WizardSectionStackProps) {
  const { fieldsLocked, premiumPinned } = useMode();
  const premiumSection = (
    <PolicyCollapsibleSection
      id={SECTION_IDS.PREMIUM}
      title="Premium"
      description="Premium breakdown and confirmation"
      open={openMap.premium ?? true}
      onOpenChange={(open) =>
        setOpenMap((prev) => ({ ...prev, premium: open }))
      }
      className={shellCardClassName}
    >
      <PremiumDeclaration
        premium={premium}
        referralReasons={referralReasons}
        reference={reference}
        notes={notes}
        rating={rating ?? policy.car.rating}
        initialManualKeys={policy.car.premiumManualKeys}
        premiumEditable={!fieldsLocked}
        onPremiumChange={
          fieldsLocked
            ? undefined
            : (next: PremiumBreakdown | undefined) => {
                premiumManuallyEditedRef.current = true;
                premiumRef.current = next;
                setPremium(next);
                hasUnsavedChangesRef.current = true;
                setHasUnsavedChanges(true);
                void persistDraft({
                  force: true,
                  skipPremiumRefresh: true,
                });
              }
        }
        onManualKeysChange={
          fieldsLocked
            ? undefined
            : (keys: string[]) => {
                premiumManualKeysRef.current = keys;
              }
        }
        onResetPremium={fieldsLocked ? undefined : onResetPremium}
        isCalculating={isCalculating}
        onExportExcel={onExportExcel}
        isExportingExcel={isExportingExcel}
        adjustmentBreakdown={
          policy.car.adjusted ? policy.car.adjustment?.breakdown : undefined
        }
      />
    </PolicyCollapsibleSection>
  );

  return (
    <fieldset
      disabled={fieldsLocked}
      className="flex min-w-0 flex-col gap-4 border-0 p-0"
      onBlurCapture={handleFieldBlur}
    >
      {premiumPinned ? premiumSection : null}

      <PolicyCollapsibleSection
        id="risk-details"
        title="Risk Details"
        description="Cover type, site, dates, and insured contracts"
        open={openMap["risk-details"] ?? true}
        onOpenChange={(open) =>
          setOpenMap((prev) => ({ ...prev, "risk-details": open }))
        }
        className={shellCardClassName}
      >
        <RiskDetails reference={reference} />
      </PolicyCollapsibleSection>

      <PolicyCollapsibleSection
        id="limits-of-liability"
        title="Limits of Liability"
        description="Contract works sums, sub-limits, and legal liability"
        open={openMap["limits-of-liability"] ?? true}
        onOpenChange={(open) =>
          setOpenMap((prev) => ({
            ...prev,
            "limits-of-liability": open,
          }))
        }
        className={shellCardClassName}
      >
        <Limits reference={reference} />
      </PolicyCollapsibleSection>

      <PolicyCollapsibleSection
        id="excesses"
        title="Excesses"
        description="Contract works and legal liability excesses"
        open={openMap.excesses ?? true}
        onOpenChange={(open) =>
          setOpenMap((prev) => ({ ...prev, excesses: open }))
        }
        className={shellCardClassName}
      >
        <Excesses />
      </PolicyCollapsibleSection>

      <PolicyCollapsibleSection
        id="claims"
        title="Claims"
        description="Claims history, exclusions, declaration, and wording"
        open={openMap.claims ?? true}
        onOpenChange={(open) =>
          setOpenMap((prev) => ({ ...prev, claims: open }))
        }
        className={shellCardClassName}
      >
        <ClaimsWording carWording={carWording} />
      </PolicyCollapsibleSection>

      {!premiumPinned ? premiumSection : null}
    </fieldset>
  );
}
