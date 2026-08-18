import { useReferenceSessionFetch } from "~/hooks/network/use-reference-session-fetch";
import {
  listReferenceSessionCacheKey,
} from "~/lib/client/reference-session-cache";
import type { ListReferenceData } from "~/lib/services/reference.service";

/** Load live AM + AR for list filters via `/api/reference/list` (session-cached). */
export function useListReference() {
  const { data: reference, pending } =
    useReferenceSessionFetch<ListReferenceData | null>({
      kind: "list-reference",
      cacheKey: listReferenceSessionCacheKey(),
      url: "/api/reference/list",
      fallback: null,
      isEmpty: (value) => value == null,
    });

  return { reference, pending };
}
