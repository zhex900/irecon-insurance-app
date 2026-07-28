import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Select } from "~/components/ui/form-controls";
import { Input } from "~/components/ui/input";
import {
  isTerminalStatus,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import type {
  AdjustmentBreakdown,
  PremiumBreakdown,
  Policy,
  ReferenceData,
} from "~/lib/db/types";
import { formatCurrency } from "~/lib/utils";
import { sanitizeAmountInput } from "~/lib/amount-input";
import { StatusBadge } from "~/components/ui/status-badge";
import { PolicyViewAdjustmentCards } from "~/components/forms/car-adjustment-wizard";

export function PricingDeclarationConfirmedStep({
  premium,
  referralReasons: _referralReasons,
  reference,
  notes: _notes,
  canChangeStatus = false,
  adjustmentBreakdown,
  onConfirmTerminalStatus,
  confirmBusy = false,
  premiumEditable = false,
  onPremiumChange,
}: {
  premium?: PremiumBreakdown;
  referralReasons: string[];
  reference: ReferenceData;
  notes?: Policy["notes"];
  canChangeStatus?: boolean;
  adjustmentBreakdown?: AdjustmentBreakdown;
  /** Persist Taken / Not taken immediately (full save). */
  onConfirmTerminalStatus?: (statusId: number) => void;
  /** True while terminal status confirm save is in flight. */
  confirmBusy?: boolean;
  /** When true, premium breakdown cells are click-to-edit. */
  premiumEditable?: boolean;
  onPremiumChange?: (next: PremiumBreakdown) => void;
}) {
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();
  const policyStatusId = Number(watch("policyStatusId"));
  const [pendingStatusId, setPendingStatusId] = useState<number | null>(null);
  const [awaitingConfirmSave, setAwaitingConfirmSave] = useState(false);
  const sawConfirmBusyRef = useRef(false);
  const statusLocked = !canChangeStatus || isTerminalStatus(policyStatusId);
  const selectedStatus = reference.policyStatuses.find(
    (status) => status.policyStatusId === policyStatusId,
  );

  const pendingStatusName =
    pendingStatusId == null
      ? null
      : (reference.policyStatuses.find(
          (status) => status.policyStatusId === pendingStatusId,
        )?.name ?? null);

  const confirmLoading = awaitingConfirmSave || confirmBusy;

  useEffect(() => {
    if (!awaitingConfirmSave) return;
    if (confirmBusy) {
      sawConfirmBusyRef.current = true;
      return;
    }
    if (!sawConfirmBusyRef.current) return;
    sawConfirmBusyRef.current = false;
    setAwaitingConfirmSave(false);
    setPendingStatusId(null);
  }, [awaitingConfirmSave, confirmBusy]);

  function confirmStatusChange() {
    if (pendingStatusId == null) return;
    const next = pendingStatusId;
    if (onConfirmTerminalStatus) {
      setAwaitingConfirmSave(true);
      sawConfirmBusyRef.current = false;
      onConfirmTerminalStatus(next);
      return;
    }
    setPendingStatusId(null);
    setValue("policyStatusId", next, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }

  function cancelStatusChange() {
    if (confirmLoading) return;
    setPendingStatusId(null);
  }

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
    onPremiumChange({ ...currentPremium, [key]: value });
  }

  const canEdit = premiumEditable && Boolean(onPremiumChange);

  return (
    <div className="flex flex-col gap-6">
      <Card size="sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Policy Status</CardTitle>
          <CardAction className="self-center justify-self-auto">
            {!statusLocked ? (
              <Select
                aria-label="Policy status"
                className="w-40"
                error={errors.policyStatusId?.message}
                value={policyStatusId || ""}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (isTerminalStatus(next)) {
                    setPendingStatusId(next);
                    return;
                  }
                  setValue("policyStatusId", next, {
                    shouldDirty: true,
                    shouldValidate: false,
                  });
                }}
              >
                {reference.policyStatuses.map((status) => (
                  <option
                    key={status.policyStatusId}
                    value={status.policyStatusId}
                  >
                    {status.name}
                  </option>
                ))}
              </Select>
            ) : selectedStatus ? (
              <StatusBadge
                statusId={selectedStatus.policyStatusId}
                name={selectedStatus.name}
              />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </CardAction>
        </CardHeader>
      </Card>

      <Dialog
        open={pendingStatusId != null}
        onOpenChange={(open) => {
          if (!open) cancelStatusChange();
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Mark policy as {pendingStatusName ?? "selected status"}?
            </DialogTitle>
            <DialogDescription>
              This sets the status to{" "}
              {pendingStatusName ?? "the selected status"}. Taken and Not taken
              are final and cannot be changed afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={cancelStatusChange}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              onClick={confirmStatusChange}
              loading={confirmLoading}
              loadingLabel="Confirming…"
            >
              Confirm
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Premium Breakdown</CardTitle>
          {canEdit ? (
            <p className="text-sm font-normal text-muted-foreground">
              Click a value to edit it.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4">Component</th>
                <th className="py-2 pr-4">Contract Works</th>
                <th className="py-2 pr-4">Legal Liability</th>
                <th className="py-2">Combined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <PremiumRow
                label="Base Premium"
                s1={premium.contractWorksCalculatedBasePremium}
                s2={premium.liabilityCalculatedBasePremium}
                s1Key="contractWorksCalculatedBasePremium"
                s2Key="liabilityCalculatedBasePremium"
                editable={canEdit}
                onChange={patchPremium}
              />
              <PremiumRow
                label="True Base Premium"
                s1={premium.contractWorksBasePremium}
                s2={premium.liabilityBasePremium}
                s1Key="contractWorksBasePremium"
                s2Key="liabilityBasePremium"
                combined={
                  premium.contractWorksBasePremium +
                  premium.liabilityBasePremium +
                  premium.contractWorksTerrorismPremium +
                  premium.contractWorksPlantPremium +
                  premium.contractWorksPlantTerrorismPremium +
                  (premium.contractWorksDisplayHomesPremium ?? 0) +
                  (premium.contractWorksExistingStructurePremium ?? 0)
                }
                editable={canEdit}
                onChange={patchPremium}
              />
              <PremiumRow
                label="Terrorism Levy"
                s1={premium.contractWorksTerrorismPremium}
                s1Key="contractWorksTerrorismPremium"
                editable={canEdit}
                onChange={patchPremium}
              />
              <PremiumRow
                label="Display Homes"
                s1={premium.contractWorksDisplayHomesPremium ?? 0}
                s1Key="contractWorksDisplayHomesPremium"
                editable={canEdit}
                onChange={patchPremium}
              />
              <PremiumRow
                label="Existing Structure"
                s1={premium.contractWorksExistingStructurePremium ?? 0}
                s1Key="contractWorksExistingStructurePremium"
                editable={canEdit}
                onChange={patchPremium}
              />
              <PremiumRow
                label="Plant and Equipment"
                s1={premium.contractWorksPlantPremium}
                s1Key="contractWorksPlantPremium"
                editable={canEdit}
                onChange={patchPremium}
              />
              <PremiumRow
                label="Terrorism Levy Plant and Equipment"
                s1={premium.contractWorksPlantTerrorismPremium}
                s1Key="contractWorksPlantTerrorismPremium"
                editable={canEdit}
                onChange={patchPremium}
              />
              <PremiumRow
                label="ESL Plant and Equipment"
                s1={premium.contractWorksPlantESL}
                s1Key="contractWorksPlantESL"
                editable={canEdit}
                onChange={patchPremium}
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
              />
              <PremiumRow
                label="GST"
                s1={premium.contractWorksGST}
                s2={premium.liabilityGST}
                s1Key="contractWorksGST"
                s2Key="liabilityGST"
                combined={premium.contractWorksGST + premium.liabilityGST}
                editable={canEdit}
                onChange={patchPremium}
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
              />
              {reference.feeNames.map((fee) => (
                <tr key={fee.name}>
                  <td className="py-2 pr-4">{fee.name}</td>
                  <td className="py-2 pr-4" colSpan={2} />
                  <td className="py-2">
                    {formatCurrency(fee.fee + fee.feeGst)}
                  </td>
                </tr>
              ))}
              <PremiumRow
                label="Total Premium"
                s1={premium.contractWorksTotalPremium}
                s2={premium.liabilityTotalPremium}
                combined={premium.originalTotalPremium}
                s1Key="contractWorksTotalPremium"
                s2Key="liabilityTotalPremium"
                combinedKey="originalTotalPremium"
                editable={canEdit}
                onChange={patchPremium}
                strong
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {adjustmentBreakdown ? (
        <PolicyViewAdjustmentCards breakdown={adjustmentBreakdown} />
      ) : null}
    </div>
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
}) {
  return (
    <tr className={strong ? "font-semibold" : undefined}>
      <td className="py-2 pr-4">{label}</td>
      <PremiumValueCell
        value={s1}
        editable={editable && Boolean(s1Key && onChange)}
        onChange={
          s1Key && onChange ? (value) => onChange(s1Key, value) : undefined
        }
      />
      <PremiumValueCell
        value={s2}
        editable={editable && Boolean(s2Key && onChange)}
        onChange={
          s2Key && onChange ? (value) => onChange(s2Key, value) : undefined
        }
      />
      <PremiumValueCell
        value={combined}
        editable={editable && Boolean(combinedKey && onChange)}
        onChange={
          combinedKey && onChange
            ? (value) => onChange(combinedKey, value)
            : undefined
        }
      />
    </tr>
  );
}

function PremiumValueCell({
  value,
  editable = false,
  onChange,
}: {
  value?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (value == null) {
    return <td className="py-2 pr-4" />;
  }

  if (!editable || !onChange) {
    return <td className="py-2 pr-4">{formatCurrency(value)}</td>;
  }

  if (editing) {
    return (
      <td className="py-1 pr-4">
        <Input
          autoFocus
          type="text"
          inputMode="decimal"
          className="h-7 max-w-36 font-normal"
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
      </td>
    );
  }

  return (
    <td className="py-2 pr-4">
      <button
        type="button"
        className="-mx-1 rounded px-1 text-left underline-offset-2 hover:bg-muted/60 hover:underline"
        title="Click to edit"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
      >
        {formatCurrency(value)}
      </button>
    </td>
  );
}
