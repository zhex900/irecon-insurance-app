import { useMemo } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import {
  buildReferralReasons,
  liabilityLimitLabel,
} from "~/lib/pricing/referral-reasons";
import type { Policy } from "~/lib/db/types";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";
import { FIELD_PATHS } from "../shared/constants";

export function useReferralReasons({
  policy,
  form,
  rating,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  rating: Policy["car"]["rating"] | undefined;
}) {
  // Live Limits of Liability / claims (referral DH/ES use limits, not premium).
  // Use useWatch to subscribe to all needed fields in one call
  const watchedFields = useWatch({
    control: form.control,
    name: [
      FIELD_PATHS.DISPLAY_HOMES,
      FIELD_PATHS.EXISTING_STRUCTURE,
      FIELD_PATHS.CLAIMS_COUNT_LAST_3_YEARS,
      FIELD_PATHS.ANY_CLAIMS_EXCEED_20K,
      FIELD_PATHS.HAS_EXISTING_CONTRACT_WORKS_COVER,
      FIELD_PATHS.PLANT_EQUIPMENT,
      FIELD_PATHS.LIABILITY_LIMIT_BAND,
      FIELD_PATHS.DATE_START,
    ],
  });

  const referralReasons = useMemo(() => {
    if (!rating) return policy.car.referralReasons ?? [];

    // Safely extract watched fields (order matches the name array above)
    const displayHomes = watchedFields[0];
    const existingStructure = watchedFields[1];
    const claimsCountLast3Years = watchedFields[2];
    const anyClaimsExceed20k = watchedFields[3];
    const hasExistingContractWorksCover = watchedFields[4];
    const plantEquipment = watchedFields[5];
    const liabilityLimitBand = watchedFields[6];
    const dateStart = watchedFields[7];

    return buildReferralReasons(
      {
        displayHomes: Number(displayHomes) || 0,
        existingStructure: Number(existingStructure) || 0,
        claimsCountLast3Years: Number(claimsCountLast3Years) || 0,
        anyClaimsExceed20k,
        hasExistingContractWorksCover,
        plantEquipment: Number(plantEquipment) || 0,
        liabilityLimitBand: Number(liabilityLimitBand) || 3,
        dateStart: String(dateStart || ""),
      },
      rating,
      liabilityLimitLabel(Number(liabilityLimitBand) || 3),
    );
  }, [rating, watchedFields, policy.car.referralReasons]);

  // Kept for callers that still pass server reasons after fetch; display is derived.
  const setReferralReasons = (): void => {
    // Intentionally empty - referral reasons are derived from form values
    // No-op callback for compatibility with existing API
  };

  return {
    referralReasons,
    setReferralReasons,
  };
}
