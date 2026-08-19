import { useReferenceSessionFetch } from "~/hooks/network/use-reference-session-fetch";
import { carWordingSessionCacheKey } from "~/lib/client/reference-session-cache";
import type { CarWording } from "~/lib/db/types";

const EMPTY_CAR_WORDING: CarWording[] = [];

/** Claims wording catalogue — loaded when Claims is opened or wording is already selected. */
export function useCarWording(enabled: boolean) {
  const { data: carWording, pending } = useReferenceSessionFetch<CarWording[]>({
    kind: "car-wording",
    cacheKey: carWordingSessionCacheKey(),
    url: "/api/car-wording",
    enabled,
    fallback: EMPTY_CAR_WORDING,
  });

  return { carWording, pending };
}
