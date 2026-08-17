import { InfoIcon } from "lucide-react";

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
  onExplainFee,
}: {
  feeNames: ReferenceData["feeNames"];
  onExplainFee: (working: PremiumLineWorking) => void;
}) {
  return (
    <>
      {feeNames.map((fee) => (
        <TableRow key={fee.name}>
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
