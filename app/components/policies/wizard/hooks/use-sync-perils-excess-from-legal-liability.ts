import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ReferenceData } from "~/lib/db/types";
import {
  PERILS_EXCESS_FIELD_KEYS,
  perilsExcessSyncKey,
  perilsExcessValuesForLegalLiability,
} from "~/lib/policies/excesses";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

type SyncPerilsOptions = {
  /** Clone / renew: replace copied Major / Minor with catalogue defaults for liabilityLimitBand. */
  syncOnMount?: boolean;
};

/** Major / Minor Perils follow Section 2 limit of liability ($10M / $20M / not insured). */
export function useSyncPerilsExcessFromLegalLiability(
  defaultExcesses: ReferenceData["defaultExcesses"],
  { syncOnMount = false }: SyncPerilsOptions = {},
) {
  const { control, setValue } = useFormContext<CarPolicyFormValues>();
  const liabilityLimitBand = useWatch({
    control,
    name: "liabilityLimitBand",
  });
  const previousSyncKey = useRef<string | undefined>(undefined);
  const skipInitialSync = useRef(!syncOnMount);

  useEffect(() => {
    const syncKey = perilsExcessSyncKey(liabilityLimitBand);
    if (skipInitialSync.current) {
      skipInitialSync.current = false;
      previousSyncKey.current = syncKey;
      return;
    }
    if (syncKey === previousSyncKey.current) return;
    previousSyncKey.current = syncKey;

    const next = perilsExcessValuesForLegalLiability(
      liabilityLimitBand,
      defaultExcesses,
    );
    for (const key of PERILS_EXCESS_FIELD_KEYS) {
      setValue(`excesses.${key}`, next[key as keyof typeof next], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [defaultExcesses, liabilityLimitBand, setValue]);
}
