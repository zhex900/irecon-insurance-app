import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  ClaimsWordingStep,
  PricingDeclarationConfirmedStep,
  RiskDetailsStep,
  ExcessesStep,
  LimitsOfLiabilityStep,
} from "./sections";
import { PolicyCollapsibleSection } from "~/components/policies/policy-form-layout";
import type {
  CarWording,
  Policy,
  PremiumBreakdown,
  ReferenceData,
} from "~/lib/db/types";
import { cn } from "~/lib/utils";

export function MobileSectionNav({
  items,
  activeSectionId,
  onNavigate,
}: {
  items: { id: string; label: string }[];
  activeSectionId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 xl:hidden">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(item.id);
            document.getElementById(item.id)?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs",
            activeSectionId === item.id
              ? "border-primary bg-primary font-medium text-primary-foreground"
              : "border-border text-muted-foreground",
          )}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

export type WizardSectionStackProps = {
  premiumPinned: boolean;
  openMap: Record<string, boolean>;
  setOpenMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  reference: ReferenceData;
  carWording: CarWording[];
  premium: PremiumBreakdown | undefined;
  referralReasons: string[];
  notes: Policy["notes"];
  canChangeStatus: boolean;
  onConfirmTerminalStatus: (statusId: number) => void;
  confirmBusy: boolean;
  fieldsLocked: boolean;
  policy: Policy;
  premiumManuallyEditedRef: MutableRefObject<boolean>;
  premiumRef: MutableRefObject<PremiumBreakdown | undefined>;
  setPremium: Dispatch<SetStateAction<PremiumBreakdown | undefined>>;
  hasUnsavedChangesRef: MutableRefObject<boolean>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  persistDraft: (opts?: { force?: boolean }) => Promise<unknown>;
  handleFieldBlur: () => void;
  shellCardClassName?: string;
};

export function WizardSectionStack({
  premiumPinned,
  openMap,
  setOpenMap,
  reference,
  carWording,
  premium,
  referralReasons,
  notes,
  canChangeStatus,
  onConfirmTerminalStatus,
  confirmBusy,
  fieldsLocked,
  policy,
  premiumManuallyEditedRef,
  premiumRef,
  setPremium,
  hasUnsavedChangesRef,
  setHasUnsavedChanges,
  persistDraft,
  handleFieldBlur,
  shellCardClassName,
}: WizardSectionStackProps) {
  return (
    <fieldset
      disabled={fieldsLocked}
      className="flex min-w-0 flex-col gap-4 border-0 p-0"
      onBlurCapture={handleFieldBlur}
    >
      {premiumPinned ? (
        <PolicyCollapsibleSection
          id="premium"
          title="Premium"
          description="Status, premium breakdown, and confirmation"
          open={openMap.premium ?? true}
          onOpenChange={(open) =>
            setOpenMap((prev) => ({ ...prev, premium: open }))
          }
          className={shellCardClassName}
        >
          <PricingDeclarationConfirmedStep
            premium={premium}
            referralReasons={referralReasons}
            reference={reference}
            notes={notes}
            canChangeStatus={canChangeStatus}
            onConfirmTerminalStatus={onConfirmTerminalStatus}
            confirmBusy={confirmBusy}
            premiumEditable={false}
            adjustmentBreakdown={
              policy.car.adjusted ? policy.car.adjustment?.breakdown : undefined
            }
          />
        </PolicyCollapsibleSection>
      ) : null}

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
        <RiskDetailsStep reference={reference} />
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
        <LimitsOfLiabilityStep reference={reference} />
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
        <ExcessesStep />
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
        <ClaimsWordingStep carWording={carWording} />
      </PolicyCollapsibleSection>

      {!premiumPinned ? (
        <PolicyCollapsibleSection
          id="premium"
          title="Premium"
          description="Status, premium breakdown, and confirmation"
          open={openMap.premium ?? true}
          onOpenChange={(open) =>
            setOpenMap((prev) => ({ ...prev, premium: open }))
          }
          className={shellCardClassName}
        >
          <PricingDeclarationConfirmedStep
            premium={premium}
            referralReasons={referralReasons}
            reference={reference}
            notes={notes}
            canChangeStatus={canChangeStatus}
            onConfirmTerminalStatus={onConfirmTerminalStatus}
            confirmBusy={confirmBusy}
            premiumEditable={!fieldsLocked}
            onPremiumChange={(next) => {
              premiumManuallyEditedRef.current = true;
              premiumRef.current = next;
              setPremium(next);
              hasUnsavedChangesRef.current = true;
              setHasUnsavedChanges(true);
              void persistDraft({ force: true });
            }}
            adjustmentBreakdown={
              policy.car.adjusted ? policy.car.adjustment?.breakdown : undefined
            }
          />
        </PolicyCollapsibleSection>
      ) : null}
    </fieldset>
  );
}
