import { memo } from "react";

import type { Policy, ReferenceData } from "~/lib/db/types";

import { useWizardDisplayFields } from "../hooks/wizard/use-wizard-display-fields";
import { PremiumSummary } from "../sections/premium-summary";
import type { PremiumPanelProps } from "./assemble-wizard-state";

type PremiumDisplayProps = {
  premiumPanelProps: PremiumPanelProps;
  policy: Policy;
  reference: ReferenceData;
  documentsOnly?: boolean;
};

const PremiumDisplay = memo(function PremiumDisplay({
  premiumPanelProps,
  policy,
  reference,
  documentsOnly = false,
}: PremiumDisplayProps) {
  const { livePolicyNumber } = useWizardDisplayFields(policy, reference);
  return (
    <PremiumSummary
      {...premiumPanelProps}
      policyNumber={livePolicyNumber}
      documentsOnly={documentsOnly}
      adjustment={
        policy.car.adjusted ? policy.car.adjustment : undefined
      }
    />
  );
});

type DesktopPremiumProps = Omit<PremiumDisplayProps, "documentsOnly">;

export const DesktopPremium = memo(function DesktopPremium(
  props: DesktopPremiumProps,
) {
  return <PremiumDisplay {...props} />;
});

export const MobilePremium = memo(function MobilePremium(
  props: DesktopPremiumProps,
) {
  return (
    <div className="xl:hidden">
      <PremiumDisplay {...props} documentsOnly />
    </div>
  );
});
