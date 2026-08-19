import { PolicyViewAdjustmentCards } from "~/components/policies/car-adjustment-wizard";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type {
  AdjustmentBreakdown,
  PremiumBreakdown,
  RatingSnapshot,
  ReferenceData,
} from "~/lib/db/types";

import { PremiumBreakdownHeader } from "./premium-breakdown-header";
import { PremiumBreakdownTable } from "./premium-breakdown-table";
import { PremiumWorkingDialog } from "./premium-working-dialog";
import { usePremiumDeclarationEditing } from "./use-premium-declaration-editing";

type PremiumDeclarationProps = {
  premium?: PremiumBreakdown;
  reference: ReferenceData;
  referenceFeeNamesPending?: boolean;
  rating?: RatingSnapshot;
  adjustmentBreakdown?: AdjustmentBreakdown;
  premiumEditable?: boolean;
  initialManualKeys?: string[];
  onPremiumChange?: (next: PremiumBreakdown) => void;
  onManualKeysChange?: (keys: string[]) => void;
  onResetPremium?: () => void;
  isCalculating?: boolean;
  onExportExcel?: () => void;
  isExportingExcel?: boolean;
};

export function PremiumDeclaration(props: PremiumDeclarationProps) {
  if (!props.premium) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Premium has not been calculated yet. Complete the pricing fields and
          return to this step — premium calculates automatically.
        </CardContent>
      </Card>
    );
  }
  return <PremiumDeclarationReady {...props} premium={props.premium} />;
}

function PremiumBreakdownCard({
  premium,
  reference,
  referenceFeeNamesPending = false,
  canEdit,
  editing,
  isCalculating,
  isExportingExcel,
  onResetPremium,
  onExportExcel,
}: {
  premium: PremiumBreakdown;
  reference: ReferenceData;
  referenceFeeNamesPending?: boolean;
  canEdit: boolean;
  editing: ReturnType<typeof usePremiumDeclarationEditing>;
  isCalculating: boolean;
  isExportingExcel: boolean;
  onResetPremium?: () => void;
  onExportExcel?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Premium Breakdown</CardTitle>
        <PremiumBreakdownHeader
          isCalculating={isCalculating}
          isExportingExcel={isExportingExcel}
          onResetPremium={
            onResetPremium
              ? () => {
                  editing.resetManualEdits();
                  onResetPremium();
                }
              : undefined
          }
          onExportExcel={onExportExcel}
        />
      </CardHeader>
      <CardContent className="min-w-0 overflow-x-hidden">
        <PremiumBreakdownTable
          premium={premium}
          reference={reference}
          referenceFeeNamesPending={referenceFeeNamesPending}
          canEdit={canEdit}
          manualKeys={editing.manualKeys}
          onChange={editing.patchPremium}
          onExplain={editing.openWorking}
          onExplainFee={editing.setWorking}
        />
      </CardContent>
    </Card>
  );
}

function PremiumDeclarationReady({
  premium,
  reference,
  referenceFeeNamesPending = false,
  rating,
  adjustmentBreakdown,
  premiumEditable,
  initialManualKeys,
  onPremiumChange,
  onManualKeysChange,
  onResetPremium,
  isCalculating,
  onExportExcel,
  isExportingExcel,
}: PremiumDeclarationProps & { premium: PremiumBreakdown }) {
  const editing = usePremiumDeclarationEditing({
    premium,
    rating,
    initialManualKeys,
    onPremiumChange,
    onManualKeysChange,
  });

  return (
    <div className="flex flex-col gap-6">
      <PremiumBreakdownCard
        premium={premium}
        reference={reference}
        referenceFeeNamesPending={referenceFeeNamesPending}
        canEdit={Boolean(premiumEditable && onPremiumChange)}
        editing={editing}
        isCalculating={isCalculating ?? false}
        isExportingExcel={isExportingExcel ?? false}
        onResetPremium={onResetPremium}
        onExportExcel={onExportExcel}
      />
      {adjustmentBreakdown ? (
        <PolicyViewAdjustmentCards breakdown={adjustmentBreakdown} />
      ) : null}
      <PremiumWorkingDialog
        working={editing.working}
        onOpenChange={(open) => {
          if (!open) editing.setWorking(null);
        }}
      />
    </div>
  );
}
