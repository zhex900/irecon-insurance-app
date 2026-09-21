import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";

import type { PremiumBreakdown, RatingSnapshot } from "~/lib/db/types";
import {
  applyManualPremiumEdit,
  type ManualPremiumSessionRates,
} from "~/lib/pricing/premium-manual-recalc";
import {
  buildPremiumLineWorking,
  type PremiumLineWorking,
  type PremiumWorkingInputs,
} from "~/lib/pricing/premium-workings";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

function applyPremiumPatch(options: {
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  key: keyof PremiumBreakdown;
  value: number;
  sessionRates: ManualPremiumSessionRates | undefined;
  manualKeys: Set<string>;
  onPremiumChange: (next: PremiumBreakdown) => void;
  onManualKeysChange?: (keys: string[]) => void;
  setManualKeys: Dispatch<SetStateAction<Set<string>>>;
  setSessionRates: Dispatch<
    SetStateAction<ManualPremiumSessionRates | undefined>
  >;
}): void {
  const nextManualKeys = new Set(options.manualKeys);
  nextManualKeys.add(options.key);
  options.setManualKeys(nextManualKeys);
  options.onManualKeysChange?.([...nextManualKeys]);
  const result = applyManualPremiumEdit({
    premium: options.premium,
    rating: options.rating,
    key: options.key,
    value: options.value,
    sessionRates: options.sessionRates,
  });
  options.setSessionRates(result.sessionRates);
  options.onPremiumChange(result.premium);
}

function usePremiumWorkingInputs(
  premium: PremiumBreakdown,
): PremiumWorkingInputs {
  const { watch } = useFormContext<CarPolicyFormValues>();
  const estimatedTurnover = Number(watch("estimatedTurnover") || 0);
  const plantEquipment = Number(watch("plantEquipment") || 0);
  const contractWorksSumInsured = Number(watch("contractWorksSumInsured") || 0);
  const dateStart = String(watch("dateStart") || "");
  return useMemo(
    () => ({
      estimatedTurnover,
      plantEquipment,
      contractWorksSumInsured,
      dateStart,
      brokerFeeTotal: premium.combinedBrokerFee ?? 0,
    }),
    [
      estimatedTurnover,
      plantEquipment,
      contractWorksSumInsured,
      dateStart,
      premium.combinedBrokerFee,
    ],
  );
}

function createPremiumEditActions(options: {
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  workingInputs: PremiumWorkingInputs;
  sessionRates: ManualPremiumSessionRates | undefined;
  manualKeys: Set<string>;
  onPremiumChange?: (next: PremiumBreakdown) => void;
  onManualKeysChange?: (keys: string[]) => void;
  setManualKeys: Dispatch<SetStateAction<Set<string>>>;
  setSessionRates: Dispatch<
    SetStateAction<ManualPremiumSessionRates | undefined>
  >;
  setWorking: Dispatch<SetStateAction<PremiumLineWorking | null>>;
}) {
  function patchPremium(key: keyof PremiumBreakdown, value: number) {
    const onPremiumChange = options.onPremiumChange;
    if (!onPremiumChange) return;
    applyPremiumPatch({ ...options, onPremiumChange, key, value });
  }
  function openWorking(title: string, key: keyof PremiumBreakdown) {
    options.setWorking(
      buildPremiumLineWorking({
        title,
        key,
        premium: options.premium,
        rating: options.rating,
        inputs: options.workingInputs,
        explicitManualKeys: options.manualKeys,
      }),
    );
  }
  function resetManualEdits() {
    options.setManualKeys(new Set());
    options.onManualKeysChange?.([]);
    options.setSessionRates(undefined);
    options.setWorking(null);
  }
  return { patchPremium, openWorking, resetManualEdits };
}

export function usePremiumDeclarationEditing(options: {
  premium: PremiumBreakdown;
  rating?: RatingSnapshot;
  initialManualKeys?: string[];
  onPremiumChange?: (next: PremiumBreakdown) => void;
  onManualKeysChange?: (keys: string[]) => void;
}) {
  const workingInputs = usePremiumWorkingInputs(options.premium);
  const initialKeys = options.initialManualKeys ?? [];
  const initialKeysKey = initialKeys.join("\0");
  const [manualKeys, setManualKeys] = useState<Set<string>>(
    () => new Set(initialKeys),
  );
  const [prevInitialKeysKey, setPrevInitialKeysKey] = useState(initialKeysKey);

  if (prevInitialKeysKey !== initialKeysKey) {
    setPrevInitialKeysKey(initialKeysKey);
    setManualKeys(new Set(initialKeys));
  }

  const [sessionRates, setSessionRates] = useState<
    ManualPremiumSessionRates | undefined
  >(undefined);
  const [working, setWorking] = useState<PremiumLineWorking | null>(null);
  return {
    manualKeys,
    working,
    setWorking,
    ...createPremiumEditActions({
      ...options,
      workingInputs,
      sessionRates,
      manualKeys,
      setManualKeys,
      setSessionRates,
      setWorking,
    }),
  };
}
