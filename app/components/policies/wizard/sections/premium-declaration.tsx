import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import {
  FileSpreadsheetIcon,
  InfoIcon,
  PencilIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";
import type {
  AdjustmentBreakdown,
  PremiumBreakdown,
  Policy,
  RatingSnapshot,
  ReferenceData,
} from "~/lib/db/types";
import { cn, formatCurrency } from "~/lib/utils";
import { sanitizeAmountInput } from "~/lib/amount-input";
import { PolicyViewAdjustmentCards } from "~/components/policies/car-adjustment-wizard";
import {
  buildPremiumLineWorking,
  isPremiumLineManual,
  type PremiumLineWorking,
  type PremiumWorkingInputs,
} from "~/lib/pricing/premium-workings";
import { useFieldSaveState } from "~/components/forms/field-save-highlight";
import {
  combinedTrueBasePremium,
  rollupPremiumTotals,
} from "~/lib/pricing/premium-totals";
import {
  applyManualPremiumEdit,
  type ManualPremiumSessionRates,
} from "~/lib/pricing/premium-manual-recalc";

export function PricingDeclarationConfirmed({
  premium,
  referralReasons: _referralReasons,
  reference,
  notes: _notes,
  rating,
  adjustmentBreakdown,
  premiumEditable = false,
  initialManualKeys,
  onPremiumChange,
  onManualKeysChange,
  onResetPremium,
  isCalculating = false,
  onExportExcel,
  isExportingExcel = false,
}: {
  premium?: PremiumBreakdown;
  referralReasons: string[];
  reference: ReferenceData;
  notes?: Policy["notes"];
  rating?: RatingSnapshot;
  adjustmentBreakdown?: AdjustmentBreakdown;
  /** When true, premium breakdown cells are click-to-edit. */
  premiumEditable?: boolean;
  /** Persisted Premium Breakdown keys the broker previously edited. */
  initialManualKeys?: string[];
  onPremiumChange?: (next: PremiumBreakdown) => void;
  /** Keep draft snapshot / app_extras in sync with session manual keys. */
  onManualKeysChange?: (keys: string[]) => void;
  /** Clear manual overrides and recalculate from rates. */
  onResetPremium?: () => void;
  isCalculating?: boolean;
  /** Export / download premium breakdown Excel. */
  onExportExcel?: () => void;
  isExportingExcel?: boolean;
}) {
  const { watch } = useFormContext<CarPolicyFormValues>();
  const estimatedTurnover = Number(watch("estimatedTurnover") || 0);
  const plantEquipment = Number(watch("plantEquipment") || 0);
  const contractWorksSumInsured = Number(watch("contractWorksSumInsured") || 0);
  const dateStart = String(watch("dateStart") || "");
  const [manualKeys, setManualKeys] = useState<Set<string>>(
    () => new Set(initialManualKeys ?? []),
  );
  /** Session τ / plant ESL rate for subsequent Premium Breakdown edits. */
  const [sessionRates, setSessionRates] = useState<
    ManualPremiumSessionRates | undefined
  >(undefined);
  const [working, setWorking] = useState<PremiumLineWorking | null>(null);

  const workingInputs = useMemo<PremiumWorkingInputs>(
    () => ({
      estimatedTurnover,
      plantEquipment,
      contractWorksSumInsured,
      dateStart,
      brokerFeeTotal: premium?.combinedBrokerFee ?? 0,
    }),
    [
      estimatedTurnover,
      plantEquipment,
      contractWorksSumInsured,
      dateStart,
      premium?.combinedBrokerFee,
    ],
  );

  if (!premium) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Premium has not been calculated yet. Complete the pricing fields and
          return to this step — premium calculates automatically.
        </CardContent>
      </Card>
    );
  }

  const currentPremium = premium;

  function patchPremium(key: keyof PremiumBreakdown, value: number) {
    if (!onPremiumChange) return;
    if (key === "contractWorksBasePremium" || key === "liabilityBasePremium") {
      const current = Number(currentPremium[key]) || 0;
      if (value < current) {
        toast.error("True base premium cannot be decreased.");
        return;
      }
    }
    setManualKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      onManualKeysChange?.([...next]);
      return next;
    });
    const result = applyManualPremiumEdit({
      premium: currentPremium,
      rating,
      key,
      value,
      sessionRates,
    });
    setSessionRates(result.sessionRates);
    onPremiumChange(result.premium);
  }

  function openWorking(title: string, key: keyof PremiumBreakdown) {
    setWorking(
      buildPremiumLineWorking({
        title,
        key,
        premium: currentPremium,
        rating,
        inputs: workingInputs,
        explicitManualKeys: manualKeys,
      }),
    );
  }

  const canEdit = premiumEditable && Boolean(onPremiumChange);
  const totals = rollupPremiumTotals(premium);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Premium Breakdown</CardTitle>
          {onResetPremium || onExportExcel ? (
            <CardAction className="flex items-center gap-1.5 self-center justify-self-auto">
              {onResetPremium ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Reset premium"
                        disabled={isCalculating}
                        onClick={() => {
                          setManualKeys(new Set());
                          onManualKeysChange?.([]);
                          setSessionRates(undefined);
                          setWorking(null);
                          onResetPremium();
                        }}
                      />
                    }
                  >
                    <RotateCcwIcon
                      className={cn(isCalculating && "animate-spin")}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Reset premium. Manual edits will be cleared.
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {onExportExcel ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      // Not a <button>: this card sits in a disabled fieldset when
                      // the policy is view-only, and native controls ignore clicks.
                      <span
                        role="button"
                        tabIndex={isExportingExcel ? -1 : 0}
                        aria-label="Export premium to Excel"
                        aria-disabled={isExportingExcel || undefined}
                        className={cn(
                          "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background shadow-xs transition-colors outline-none",
                          "hover:b g-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                          isExportingExcel &&
                            "pointer-events-none cursor-default opacity-50",
                        )}
                        onClick={() => {
                          if (isExportingExcel) return;
                          onExportExcel();
                        }}
                        onKeyDown={(event) => {
                          if (isExportingExcel) return;
                          if (event.key !== "Enter" && event.key !== " ")
                            return;
                          event.preventDefault();
                          onExportExcel();
                        }}
                      />
                    }
                  >
                    <FileSpreadsheetIcon
                      className={cn(
                        "size-4 text-success",
                        isExportingExcel && "animate-pulse",
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Download Excel (regenerates when premium or inputs change)
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="min-w-0 overflow-x-hidden">
          <Table className="w-full table-fixed text-sm">
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
            <TableBody>
              <PremiumRow
                label="Base Premium"
                s1={premium.contractWorksCalculatedBasePremium}
                s2={premium.liabilityCalculatedBasePremium}
                s1Key="contractWorksCalculatedBasePremium"
                s2Key="liabilityCalculatedBasePremium"
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="True Base Premium"
                s1={premium.contractWorksBasePremium}
                s2={premium.liabilityBasePremium}
                s1Key="contractWorksBasePremium"
                s2Key="liabilityBasePremium"
                combined={combinedTrueBasePremium(premium)}
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="Terrorism Levy"
                s1={premium.contractWorksTerrorismPremium}
                s1Key="contractWorksTerrorismPremium"
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="Display Homes"
                s1={premium.contractWorksDisplayHomesPremium ?? 0}
                s1Key="contractWorksDisplayHomesPremium"
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="Existing Structure"
                s1={premium.contractWorksExistingStructurePremium ?? 0}
                s1Key="contractWorksExistingStructurePremium"
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="Plant and Equipment"
                s1={premium.contractWorksPlantPremium}
                s1Key="contractWorksPlantPremium"
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="Terrorism Levy Plant and Equipment"
                s1={premium.contractWorksPlantTerrorismPremium}
                s1Key="contractWorksPlantTerrorismPremium"
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="ESL Plant and Equipment"
                s1={premium.contractWorksPlantESL}
                s1Key="contractWorksPlantESL"
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="ESL"
                s1={premium.contractWorksESL}
                s2={premium.liabilityESL}
                s1Key="contractWorksESL"
                s2Key="liabilityESL"
                combined={
                  premium.contractWorksESL +
                  premium.liabilityESL +
                  premium.contractWorksPlantESL
                }
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="GST"
                s1={premium.contractWorksGST}
                s2={premium.liabilityGST}
                combined={premium.contractWorksGST + premium.liabilityGST}
                onExplain={openWorking}
                s1Key="contractWorksGST"
                manualKeys={manualKeys}
              />
              <PremiumRow
                label="Stamp Duty"
                s1={premium.contractWorksStampDuty}
                s2={premium.liabilityStampDuty}
                s1Key="contractWorksStampDuty"
                s2Key="liabilityStampDuty"
                combined={
                  premium.contractWorksStampDuty + premium.liabilityStampDuty
                }
                editable={canEdit}
                onChange={patchPremium}
                onExplain={openWorking}
                manualKeys={manualKeys}
              />
              {reference.feeNames.map((fee) => (
                <TableRow key={fee.name}>
                  <TableCell className="py-2 pr-2">
                    <span className="wrap-break-word">
                      {fee.name}{" "}
                      <PremiumExplainTrigger
                        label={`How ${fee.name} is calculated`}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() =>
                          setWorking({
                            title: fee.name,
                            steps: [
                              {
                                label: "Fee (ex GST)",
                                detail: formatCurrency(fee.fee),
                              },
                              {
                                label: "GST",
                                detail: formatCurrency(fee.feeGst),
                              },
                              {
                                label: "Total (incl GST)",
                                detail: formatCurrency(fee.fee + fee.feeGst),
                              },
                            ],
                            calculated: fee.fee + fee.feeGst,
                            current: fee.fee + fee.feeGst,
                            manual: false,
                          })
                        }
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
              <PremiumRow
                label="Total Premium"
                s1={totals.contractWorksTotalPremium}
                s2={totals.liabilityTotalPremium}
                combined={totals.originalTotalPremium}
                manualKeys={manualKeys}
                strong
              />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {adjustmentBreakdown ? (
        <PolicyViewAdjustmentCards breakdown={adjustmentBreakdown} />
      ) : null}

      <PremiumWorkingDialog
        working={working}
        onOpenChange={(open) => {
          if (!open) setWorking(null);
        }}
      />
    </div>
  );
}

/**
 * Must not be a <button>/<input>: premium sits in a disabled fieldset when the
 * policy is view-only, and native form controls inside that fieldset ignore clicks.
 */
function PremiumExplainTrigger({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  function activate() {
    onClick();
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate();
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-4 translate-y-px cursor-pointer items-center justify-center rounded-full align-text-bottom outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        activate();
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </span>
  );
}

function PremiumWorkingDialog({
  working,
  onOpenChange,
}: {
  working: PremiumLineWorking | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={working != null} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40 supports-backdrop-filter:backdrop-blur-md" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-lg",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          {working ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{working.title}</DialogTitle>
              </DialogHeader>
              {working.manual ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <PencilIcon className="size-3.5" aria-hidden />
                    Manually adjusted
                  </p>
                  <p className="mt-1 text-xs text-warning/90">
                    Calculated {formatCurrency(working.calculated)} · Current{" "}
                    {formatCurrency(working.current)}
                  </p>
                </div>
              ) : null}
              <ol className="flex flex-col gap-2">
                {working.steps.map((item, index) => (
                  <li
                    key={`${item.label}-${index}`}
                    className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    {item.detail ? (
                      <span className="text-right font-medium break-all tabular-nums">
                        {item.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    className="absolute top-2 right-2"
                    size="icon-sm"
                  />
                }
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </DialogClose>
            </>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

function PremiumRow({
  label,
  s1,
  s2,
  combined,
  strong,
  editable = false,
  s1Key,
  s2Key,
  combinedKey,
  onChange,
  onExplain,
  manualKeys,
}: {
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
}) {
  const explainKey = s1Key ?? s2Key ?? combinedKey;
  const s1Manual = s1Key != null && isPremiumLineManual(s1Key, manualKeys);
  const s2Manual = s2Key != null && isPremiumLineManual(s2Key, manualKeys);
  const combinedManual =
    combinedKey != null && isPremiumLineManual(combinedKey, manualKeys);
  const rowManual = s1Manual || s2Manual || combinedManual;
  const { attention, className: highlightClassName } = useFieldSaveState(
    s1Key ?? s2Key ?? combinedKey,
  );
  const rowId = s1Key ?? s2Key ?? combinedKey;

  return (
    <TableRow
      id={rowId ? `premium-row-${rowId}` : undefined}
      className={cn(strong && "font-semibold")}
    >
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
      <PremiumValueCell
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
        value={s2}
        editable={editable && Boolean(s2Key && onChange)}
        manual={s2Manual}
        onChange={
          s2Key && onChange ? (value) => onChange(s2Key, value) : undefined
        }
      />
      <PremiumValueCell
        value={combined}
        editable={editable && Boolean(combinedKey && onChange)}
        manual={combinedManual}
        onChange={
          combinedKey && onChange
            ? (value) => onChange(combinedKey, value)
            : undefined
        }
      />
    </TableRow>
  );
}

function PremiumValueCell({
  value,
  editable = false,
  manual = false,
  attention = false,
  className = "",
  onChange,
}: {
  value?: number;
  editable?: boolean;
  manual?: boolean;
  attention?: boolean;
  className?: string;
  onChange?: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const cellClass = "py-2 pl-4 text-right whitespace-nowrap tabular-nums";

  if (value == null) {
    return <TableCell className={cellClass} />;
  }

  const valueClass = cn(
    (manual || attention) && "font-medium text-warning",
    attention && "animate-pulse font-semibold",
  );

  if (!editable || !onChange) {
    return (
      <TableCell className={cn(cellClass, valueClass, className)}>
        {formatCurrency(value)}
      </TableCell>
    );
  }

  if (editing) {
    return (
      <TableCell className="py-1 pl-4 text-right">
        <Input
          autoFocus
          type="text"
          inputMode="decimal"
          className={cn(
            "h-7 w-full min-w-0 text-right font-normal tabular-nums",
            className,
          )}
          value={draft}
          aria-label="Edit premium value"
          onChange={(event) =>
            setDraft(sanitizeAmountInput(event.target.value))
          }
          onBlur={() => {
            const parsed = Number(draft.replace(/,/g, ""));
            if (!Number.isNaN(parsed)) onChange(parsed);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setEditing(false);
            }
          }}
        />
      </TableCell>
    );
  }

  return (
    <TableCell className={cellClass}>
      <button
        type="button"
        className={cn(
          "inline-flex w-full justify-end rounded px-0 text-right underline-offset-2 hover:bg-muted/60 hover:underline",
          valueClass,
          className,
        )}
        title={manual ? "Manually adjusted — click to edit" : "Click to edit"}
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
      >
        {formatCurrency(value)}
      </button>
    </TableCell>
  );
}
