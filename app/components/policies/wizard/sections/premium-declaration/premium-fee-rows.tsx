import { InfoIcon } from "lucide-react";

import { Skeleton } from "~/components/ui/skeleton";
import { TableCell, TableRow } from "~/components/ui/table";
import type { ReferenceData } from "~/lib/db/types";
import type { PremiumLineWorking } from "~/lib/pricing/premium-workings";
import { formatCurrency } from "~/lib/utils";

import { PremiumExplainTrigger } from "./premium-explain-trigger";

function feeLineWorking(
  fee: ReferenceData["feeNames"][number],
): PremiumLineWorking {
  const total = fee.fee + fee.feeGst;
  return {
    title: fee.name,
    steps: [
      { label: "Fee (ex GST)", detail: formatCurrency(fee.fee) },
      { label: "GST", detail: formatCurrency(fee.feeGst) },
      { label: "Total (incl GST)", detail: formatCurrency(total) },
    ],
    calculated: total,
    current: total,
    manual: false,
  };
}

export function PremiumFeeRows({
  feeNames,
  feeNamesPending = false,
  onExplainFee,
}: {
  feeNames: ReferenceData["feeNames"];
  feeNamesPending?: boolean;
  onExplainFee: (working: PremiumLineWorking) => void;
}) {
  if (feeNamesPending && feeNames.length === 0) {
    return (
      <>
        {[0, 1].map((index) => (
          <TableRow key={`fee-skeleton-${index}`}>
            <TableCell className="py-2 pr-2">
              <Skeleton className="h-4 w-40" aria-hidden />
            </TableCell>
            <TableCell className="py-2 pl-4" />
            <TableCell className="py-2 pl-4" />
            <TableCell className="py-2 pl-4 text-right">
              <Skeleton className="ml-auto h-4 w-16" aria-hidden />
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  }

  return (
    <>
      {feeNames.map((fee) => (
        <TableRow key={fee.sortOrder}>
          <TableCell className="py-2 pr-2">
            <span className="wrap-break-word">
              {fee.name}{" "}
              <PremiumExplainTrigger
                label={`How ${fee.name} is calculated`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onExplainFee(feeLineWorking(fee))}
              >
                <InfoIcon className="size-3.5" aria-hidden />
              </PremiumExplainTrigger>
            </span>
          </TableCell>
          <TableCell className="py-2 pl-4" />
          <TableCell className="py-2 pl-4" />
          <TableCell className="py-2 pl-4 text-right whitespace-nowrap tabular-nums">
            {formatCurrency(fee.fee + fee.feeGst)}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
