import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ReferenceData } from "~/lib/db/types";
import {
  LEGAL_LIABILITY_EXCESS_FIELD_KEYS,
  legalLiabilityExcessSyncKey,
  legalLiabilityExcessValuesFor,
} from "~/lib/policies/excesses";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

/** Keep Section 2 excesses in sync with Limit of Liability + estimated turnover band. */
export function useSyncLegalLiabilityExcess(
  defaultExcesses: ReferenceData["defaultExcesses"],
) {
  const { control, setValue } = useFormContext<CarPolicyFormValues>();
  const estimatedTurnover = useWatch({ control, name: "estimatedTurnover" });
  const liabilityLimitBand = useWatch({
    control,
    name: "liabilityLimitBand",
  });
  const previousSyncKey = useRef<string | undefined>(undefined);
  const skipInitialSync = useRef(true);

  useEffect(() => {
    const syncKey = legalLiabilityExcessSyncKey(
      estimatedTurnover,
      liabilityLimitBand,
    );
    if (skipInitialSync.current) {
      skipInitialSync.current = false;
      previousSyncKey.current = syncKey;
      return;
    }
    if (syncKey === previousSyncKey.current) return;
    previousSyncKey.current = syncKey;

    const next = legalLiabilityExcessValuesFor(
      estimatedTurnover,
      liabilityLimitBand,
      defaultExcesses,
    );
    for (const key of LEGAL_LIABILITY_EXCESS_FIELD_KEYS) {
      setValue(`excesses.${key}`, next[key as keyof typeof next], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    defaultExcesses,
    estimatedTurnover,
    liabilityLimitBand,
    setValue,
  ]);
}
