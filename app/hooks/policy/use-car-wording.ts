import { useReferenceSessionFetch } from "~/hooks/network/use-reference-session-fetch";
import {
  carWordingSessionCacheKey,
} from "~/lib/client/reference-session-cache";
import type { CarWording } from "~/lib/db/types";

/** Claims wording catalogue — loaded when the Claims section is opened. */
export function useCarWording(enabled: boolean) {
  const { data: carWording, pending } = useReferenceSessionFetch<CarWording[]>({
    kind: "car-wording",
    cacheKey: carWordingSessionCacheKey(),
    url: "/api/car-wording",
    enabled,
    fallback: [],
  });

  return { carWording, pending };
}
