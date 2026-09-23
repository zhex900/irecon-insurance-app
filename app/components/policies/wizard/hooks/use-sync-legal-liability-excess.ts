import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ReferenceData } from "~/lib/db/types";
import {
  LEGAL_LIABILITY_EXCESS_FIELD_KEYS,
  legalLiabilityExcessSyncKey,
  legalLiabilityExcessValuesFor,
} from "~/lib/policies/excesses";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

/** Section 2 excesses: contract works band, limit of liability, and turnover (Worker to Worker). */
export function useSyncLegalLiabilityExcess(
  defaultExcesses: ReferenceData["defaultExcesses"],
) {
  const { control, setValue } = useFormContext<CarPolicyFormValues>();
  const contractWorksSumInsured = useWatch({
    control,
    name: "contractWorksSumInsured",
  });
  const estimatedTurnover = useWatch({
    control,
    name: "estimatedTurnover",
  });
  const liabilityLimitBand = useWatch({
    control,
    name: "liabilityLimitBand",
  });
  const previousSyncKey = useRef<string | undefined>(undefined);
  const skipInitialSync = useRef(true);

  useEffect(() => {
    const syncKey = legalLiabilityExcessSyncKey(
      contractWorksSumInsured,
      liabilityLimitBand,
      estimatedTurnover,
    );
    if (skipInitialSync.current) {
      skipInitialSync.current = false;
      previousSyncKey.current = syncKey;
      return;
    }
    if (syncKey === previousSyncKey.current) return;
    previousSyncKey.current = syncKey;

    const next = legalLiabilityExcessValuesFor(
      contractWorksSumInsured,
      liabilityLimitBand,
      defaultExcesses,
      estimatedTurnover,
    );
    for (const key of LEGAL_LIABILITY_EXCESS_FIELD_KEYS) {
      setValue(`excesses.${key}`, next[key as keyof typeof next], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    contractWorksSumInsured,
    defaultExcesses,
    estimatedTurnover,
    liabilityLimitBand,
    setValue,
  ]);
}
