import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { CheckIcon } from "lucide-react";
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
  sectionIssueCounts = {},
  onNavigateToSectionFirstIssue,
}: {
  items: { id: string; label: string }[];
  activeSectionId: string;
  onNavigate: (id: string) => void;
  sectionIssueCounts?: Record<string, number>;
  onNavigateToSectionFirstIssue?: (sectionId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the active tag visible in the horizontal strip as scroll-spy updates.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const active = scroller.querySelector<HTMLElement>(
      `[data-section-nav-id="${CSS.escape(activeSectionId)}"]`,
    );
    if (!active) return;
    const left =
      active.offsetLeft - scroller.clientWidth / 2 + active.offsetWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [activeSectionId]);

  return (
    <div
      ref={scrollerRef}
      className="flex gap-2 overflow-x-auto pb-1 xl:hidden"
    >
      {items.map((item) => {
        const active = activeSectionId === item.id;
        const issueCount = sectionIssueCounts[item.id] ?? 0;
        const statusLabel =
          issueCount > 0
            ? `${issueCount} incomplete or invalid field${issueCount === 1 ? "" : "s"}`
            : "Section complete";

        return (
          <div
            key={item.id}
            data-section-nav-id={item.id}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs",
              active
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {issueCount > 0 ? (
              <button
                type="button"
                title={statusLabel}
                aria-label={`Go to first invalid field · ${statusLabel}`}
                className={cn(
                  "inline-flex h-4 min-w-3.5 items-center justify-center text-[11px] font-semibold tabular-nums underline-offset-2 hover:underline",
                  active ? "text-primary-foreground" : "text-destructive",
                )}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onNavigateToSectionFirstIssue?.(item.id);
                }}
              >
                {issueCount > 99 ? "99+" : issueCount}
              </button>
            ) : (
              <span
                title={statusLabel}
                aria-label={statusLabel}
                className={cn(
                  "inline-flex size-3.5 items-center justify-center",
                  active ? "text-primary-foreground" : "text-success",
                )}
              >
                <CheckIcon className="size-3" aria-hidden />
              </span>
            )}
            <a
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.id);
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="truncate pr-1"
            >
              {item.label}
            </a>
          </div>
        );
      })}
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
  fieldsLocked: boolean;
  policy: Policy;
  /** Latest rating snapshot (fetcher may be newer than policy.car.rating). */
  rating?: Policy["car"]["rating"];
  premiumManuallyEditedRef: MutableRefObject<boolean>;
  premiumRef: MutableRefObject<PremiumBreakdown | undefined>;
  setPremium: Dispatch<SetStateAction<PremiumBreakdown | undefined>>;
  hasUnsavedChangesRef: MutableRefObject<boolean>;
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

export function WizardSectionStack({
  premiumPinned,
  openMap,
  setOpenMap,
  reference,
  carWording,
  premium,
  referralReasons,
  notes,
  fieldsLocked,
  policy,
  rating,
  premiumManuallyEditedRef,
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
          description="Premium breakdown and confirmation"
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
            rating={rating ?? policy.car.rating}
            premiumEditable={!fieldsLocked}
            onPremiumChange={
              fieldsLocked
                ? undefined
                : (next) => {
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
            onResetPremium={fieldsLocked ? undefined : onResetPremium}
            isCalculating={isCalculating}
            onExportExcel={onExportExcel}
            isExportingExcel={isExportingExcel}
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
          description="Premium breakdown and confirmation"
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
            rating={rating ?? policy.car.rating}
            premiumEditable={!fieldsLocked}
            onPremiumChange={(next) => {
              premiumManuallyEditedRef.current = true;
              premiumRef.current = next;
              setPremium(next);
              hasUnsavedChangesRef.current = true;
              setHasUnsavedChanges(true);
              void persistDraft({ force: true, skipPremiumRefresh: true });
            }}
            onResetPremium={fieldsLocked ? undefined : onResetPremium}
            isCalculating={isCalculating}
            onExportExcel={onExportExcel}
            isExportingExcel={isExportingExcel}
            adjustmentBreakdown={
              policy.car.adjusted ? policy.car.adjustment?.breakdown : undefined
            }
          />
        </PolicyCollapsibleSection>
      ) : null}
    </fieldset>
  );
}
