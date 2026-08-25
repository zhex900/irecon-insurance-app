import { InfoIcon, PencilIcon } from "lucide-react";

import { useFieldSaveState } from "~/components/forms/field-save-highlight";
import { TableCell, TableRow } from "~/components/ui/table";
import type { PremiumBreakdown } from "~/lib/db/types";
import { isPremiumLineManual } from "~/lib/pricing/premium-workings";
import { cn } from "~/lib/utils";

import { PremiumExplainTrigger } from "./premium-explain-trigger";
import { PremiumValueCell } from "./premium-value-cell";

export type PremiumBreakdownRowProps = {
  label: string;
  s1?: number;
  s2?: number;
  combined?: number;
  strong?: boolean;
  editable?: boolean;
  s1Key?: keyof PremiumBreakdown;
  s2Key?: keyof PremiumBreakdown;
  combinedKey?: keyof PremiumBreakdown;
  onChange?: (key: keyof PremiumBreakdown, value: number) => void;
  onExplain?: (title: string, key: keyof PremiumBreakdown) => void;
  manualKeys: ReadonlySet<string>;
};

function PremiumRowLabel({
  label,
  explainKey,
  rowManual,
  attention,
  onExplain,
}: {
  label: string;
  explainKey?: keyof PremiumBreakdown;
  rowManual: boolean;
  attention: boolean;
  onExplain?: (title: string, key: keyof PremiumBreakdown) => void;
}) {
  return (
    <TableCell className="min-w-0 py-2 pr-2">
      <span
        className={cn(
          "wrap-break-word",
          rowManual && "text-warning",
          attention && "animate-pulse font-semibold text-warning",
        )}
      >
        {label}
        {explainKey && onExplain ? (
          <>
            {" "}
            <PremiumExplainTrigger
              label={
                rowManual
                  ? `${label} manually adjusted. View calculation`
                  : `How ${label} is calculated`
              }
              className={cn(
                "hover:bg-muted",
                rowManual
                  ? "text-warning hover:text-warning"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onExplain(label, explainKey)}
            >
              {rowManual ? (
                <PencilIcon className="size-3.5" aria-hidden />
              ) : (
                <InfoIcon className="size-3.5" aria-hidden />
              )}
            </PremiumExplainTrigger>
          </>
        ) : null}
      </span>
    </TableCell>
  );
}

function PremiumRowValueCells({
  rowLabel,
  s1,
  s2,
  combined,
  s1Key,
  s2Key,
  combinedKey,
  editable,
  onChange,
  s1Manual,
  s2Manual,
  combinedManual,
  attention,
  highlightClassName,
}: Pick<
  PremiumBreakdownRowProps,
  "s1" | "s2" | "combined" | "s1Key" | "s2Key" | "combinedKey" | "onChange"
> & {
  rowLabel: string;
  editable: boolean;
  s1Manual: boolean;
  s2Manual: boolean;
  combinedManual: boolean;
  attention: boolean;
  highlightClassName: string;
}) {
  return (
    <>
      <PremiumValueCell
        label={s1Key ?? `${rowLabel} contract works`.toLowerCase()}
        value={s1}
        editable={editable && Boolean(s1Key && onChange)}
        manual={s1Manual}
        attention={Boolean(s1Key && attention)}
        className={s1Key ? highlightClassName : ""}
        onChange={
          s1Key && onChange ? (value) => onChange(s1Key, value) : undefined
        }
      />
      <PremiumValueCell
        label={s2Key ?? `${rowLabel} legal liability`.toLowerCase()}
        value={s2}
        editable={editable && Boolean(s2Key && onChange)}
        manual={s2Manual}
        onChange={
          s2Key && onChange ? (value) => onChange(s2Key, value) : undefined
        }
      />
      <PremiumValueCell
        label={`${rowLabel} combined`.toLowerCase()}
        value={combined}
        editable={editable && Boolean(combinedKey && onChange)}
        manual={combinedManual}
        onChange={
          combinedKey && onChange
            ? (value) => onChange(combinedKey, value)
            : undefined
        }
      />
    </>
  );
}

export function PremiumBreakdownRow(props: PremiumBreakdownRowProps) {
  const { label, strong, editable = false, onExplain, manualKeys } = props;
  const explainKey = props.s1Key ?? props.s2Key ?? props.combinedKey;
  const s1Manual =
    props.s1Key != null && isPremiumLineManual(props.s1Key, manualKeys);
  const s2Manual =
    props.s2Key != null && isPremiumLineManual(props.s2Key, manualKeys);
  const combinedManual =
    props.combinedKey != null &&
    isPremiumLineManual(props.combinedKey, manualKeys);
  const { attention, className: highlightClassName } =
    useFieldSaveState(explainKey);

  return (
    <TableRow
      id={explainKey ? `premium-row-${explainKey}` : undefined}
      className={cn(strong && "font-semibold")}
    >
      <PremiumRowLabel
        label={label}
        explainKey={explainKey}
        rowManual={s1Manual || s2Manual || combinedManual}
        attention={attention}
        onExplain={onExplain}
      />
      <PremiumRowValueCells
        {...props}
        rowLabel={label}
        editable={editable}
        s1Manual={s1Manual}
        s2Manual={s2Manual}
        combinedManual={combinedManual}
        attention={attention}
        highlightClassName={highlightClassName}
      />
    </TableRow>
  );
}
