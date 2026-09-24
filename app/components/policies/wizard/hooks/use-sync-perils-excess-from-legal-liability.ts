import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ReferenceData } from "~/lib/db/types";
import {
  PERILS_EXCESS_FIELD_KEYS,
  perilsExcessSyncKey,
  perilsExcessValuesForContractWorks,
} from "~/lib/policies/excesses";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

type SyncPerilsOptions = {
  /** Clone / renew: replace copied Major / Minor with defaults for contract works band. */
  syncOnMount?: boolean;
};

/** Major / Minor Perils follow Section 1 contract works (≤ $2M vs over $2M). */
export function useSyncPerilsExcessFromLegalLiability(
  defaultExcesses: ReferenceData["defaultExcesses"],
  { syncOnMount = false }: SyncPerilsOptions = {},
) {
  const { control, setValue } = useFormContext<CarPolicyFormValues>();
  const contractWorksSumInsured = useWatch({
    control,
    name: "contractWorksSumInsured",
  });
  const previousSyncKey = useRef<string | undefined>(undefined);
  const skipInitialSync = useRef(!syncOnMount);

  useEffect(() => {
    const syncKey = perilsExcessSyncKey(contractWorksSumInsured);
    if (skipInitialSync.current) {
      skipInitialSync.current = false;
      previousSyncKey.current = syncKey;
      return;
    }
    if (syncKey === previousSyncKey.current) return;
    previousSyncKey.current = syncKey;

    const next = perilsExcessValuesForContractWorks(
      contractWorksSumInsured,
      defaultExcesses,
    );
    for (const key of PERILS_EXCESS_FIELD_KEYS) {
      setValue(`excesses.${key}`, next[key as keyof typeof next], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [contractWorksSumInsured, defaultExcesses, setValue]);
}
