import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { PremiumBreakdown, ReferenceData } from "~/lib/db/types";
import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";
import type { PremiumLineWorking } from "~/lib/pricing/premium-workings";

import { PremiumBreakdownRow } from "./premium-breakdown-row";
import {
  PREMIUM_BREAKDOWN_ROWS,
  resolvePremiumRowValues,
} from "./premium-breakdown-rows";
import { PremiumFeeRows } from "./premium-fee-rows";

function PremiumTableHead() {
  return (
    <TableHeader>
      <TableRow className="border-border text-muted-foreground">
        <TableHead className="w-1/2 py-2 pr-2">Component</TableHead>
        <TableHead className="w-[16.666%] py-2 pl-4 text-right whitespace-normal">
          Contract works
        </TableHead>
        <TableHead className="w-[16.666%] py-2 pl-4 text-right whitespace-normal">
          Legal liability
        </TableHead>
        <TableHead className="w-[16.666%] py-2 pl-4 text-right whitespace-normal">
          Combined
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function PremiumBreakdownTable({
  premium,
  reference,
  canEdit,
  manualKeys,
  onChange,
  onExplain,
  onExplainFee,
}: {
  premium: PremiumBreakdown;
  reference: ReferenceData;
  canEdit: boolean;
  manualKeys: ReadonlySet<string>;
  onChange: (key: keyof PremiumBreakdown, value: number) => void;
  onExplain: (title: string, key: keyof PremiumBreakdown) => void;
  onExplainFee: (working: PremiumLineWorking) => void;
}) {
  const totals = rollupPremiumTotals(premium);
  const lineRows = PREMIUM_BREAKDOWN_ROWS.filter((spec) => !spec.strong);
  const totalRow = PREMIUM_BREAKDOWN_ROWS.find((spec) => spec.strong);

  return (
    <Table className="w-full table-fixed text-sm">
      <PremiumTableHead />
      <TableBody>
        {lineRows.map((spec) => (
          <PremiumBreakdownRow
            key={spec.label}
            label={spec.label}
            {...resolvePremiumRowValues(spec, premium, totals)}
            s1Key={spec.s1Key}
            s2Key={spec.s2Key}
            editable={canEdit && Boolean(spec.editable)}
            onChange={onChange}
            onExplain={onExplain}
            manualKeys={manualKeys}
          />
        ))}
        <PremiumFeeRows
          feeNames={reference.feeNames}
          onExplainFee={onExplainFee}
        />
        {totalRow ? (
          <PremiumBreakdownRow
            label={totalRow.label}
            {...resolvePremiumRowValues(totalRow, premium, totals)}
            manualKeys={manualKeys}
            strong
          />
        ) : null}
      </TableBody>
    </Table>
  );
}
