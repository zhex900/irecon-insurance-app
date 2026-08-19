import { memo } from "react";

import { PolicyCollapsibleSection } from "~/components/policies/policy-form-layout";
import type { CarWording, RatingSnapshot, ReferenceData } from "~/lib/db/types";

import { useMode } from "../hooks/utils/use-mode";
import { ClaimsWording } from "../sections/claims-wording";
import { Excesses } from "../sections/excesses";
import { Limits } from "../sections/limits";
import { RiskDetails } from "../sections/risk-details";
import { PremiumSection } from "./premium-section";

type SectionStackProps = {
  openMap: Record<string, boolean>;
  setOpenMap: (
    map:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  borderClassName: string;
  handleFieldBlur: () => void;
  reference: ReferenceData;
  referenceFeeNamesPending?: boolean;
  carWording: CarWording[];
  rating: RatingSnapshot | undefined;
  premiumSectionProps: Omit<
    React.ComponentProps<typeof PremiumSection>,
    | "open"
    | "onOpenChange"
    | "reference"
    | "rating"
    | "borderClassName"
    | "fieldsLocked"
  >;
};

export const SectionStack = memo(function SectionStack({
  openMap,
  setOpenMap,
  borderClassName,
  handleFieldBlur,
  reference,
  referenceFeeNamesPending = false,
  carWording,
  rating,
  premiumSectionProps,
}: SectionStackProps) {
  const { fieldsLocked, premiumPinned } = useMode();

  const premiumSection = (
    <PremiumSection
      open={openMap.premium ?? true}
      onOpenChange={(open) =>
        setOpenMap((prev) => ({ ...prev, premium: open }))
      }
      borderClassName={borderClassName}
      reference={reference}
      referenceFeeNamesPending={referenceFeeNamesPending}
      rating={rating}
      fieldsLocked={fieldsLocked}
      {...premiumSectionProps}
    />
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
        className={borderClassName}
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
        className={borderClassName}
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
        className={borderClassName}
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
        className={borderClassName}
      >
        <ClaimsWording carWording={carWording} />
      </PolicyCollapsibleSection>

      {!premiumPinned ? premiumSection : null}
    </fieldset>
  );
});
