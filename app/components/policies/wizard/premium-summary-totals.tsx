import type { CarAdjustmentRecord, PremiumBreakdown } from "~/lib/db/types";
import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";
import { formatCurrency } from "~/lib/utils";

export function PremiumSummaryTotals({
  premium,
  referralReasons,
  isCalculating,
  adjustment,
}: {
  premium?: PremiumBreakdown;
  referralReasons?: string[];
  isCalculating?: boolean;
  adjustment?: CarAdjustmentRecord;
}) {
  const rolledPremium = premium ? rollupPremiumTotals(premium) : undefined;
  const contractWorksTotal = adjustment
    ? adjustment.adjustedContractWorksTotalPremium
    : rolledPremium?.contractWorksTotalPremium;
  const liabilityTotal = adjustment
    ? adjustment.adjustedLiabilityTotalPremium
    : rolledPremium?.liabilityTotalPremium;
  const effectiveTotal =
    rolledPremium && adjustment
      ? rolledPremium.originalTotalPremium + adjustment.adjustedTotalPremium
      : rolledPremium?.originalTotalPremium;

  if (
    premium &&
    contractWorksTotal != null &&
    liabilityTotal != null &&
    effectiveTotal != null
  ) {
    return (
      <>
        <PremiumRow
          label={
            adjustment ? "Contract works (adjusted)" : "Contract works total"
          }
          value={contractWorksTotal}
        />
        <PremiumRow
          label={
            adjustment ? "Legal liability (adjusted)" : "Legal liability total"
          }
          value={liabilityTotal}
        />
        <PremiumRow label="Broker fees" value={premium.combinedBrokerFee} />
        {adjustment ? (
          <>
            <PremiumRow
              label="Original total"
              value={premium.originalTotalPremium}
            />
            <PremiumRow
              label="Adjustment delta"
              value={adjustment.adjustedTotalPremium}
            />
          </>
        ) : null}
        <div className="border-t border-border pt-3 font-semibold">
          <PremiumRow
            label={adjustment ? "Effective total premium" : "Total premium"}
            value={effectiveTotal}
            strong
          />
        </div>
        {referralReasons && referralReasons.length > 0 ? (
          <ReferralReasons reasons={referralReasons} />
        ) : null}
      </>
    );
  }

  if (isCalculating) {
    return <p className="text-muted-foreground">Calculating premium…</p>;
  }

  return (
    <>
      <p className="text-muted-foreground">
        Complete pricing fields to see premium.
      </p>
      {referralReasons && referralReasons.length > 0 ? (
        <ReferralReasons reasons={referralReasons} />
      ) : null}
    </>
  );
}

function ReferralReasons({ reasons }: { reasons: string[] }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-warning/30 p-px">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-border-rotate rounded-full bg-[conic-gradient(var(--warning)_20deg,transparent_120deg)] motion-reduce:animate-none"
      />
      <div className="relative z-10 rounded-[calc(var(--radius-md)-1px)] bg-[color-mix(in_oklab,var(--warning)_10%,var(--card))] p-3 text-warning-foreground">
        <p className="font-medium">Referral reasons</p>
        <ul className="mt-2 list-disc pl-5">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PremiumRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 text-foreground ${strong ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span aria-label={`premium summary ${label}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
