import { fieldMatches } from "~/lib/search/match";
import type { GlobalSearchClientHit } from "~/lib/services/search/global-search.service";

export type ClientSearchResult = GlobalSearchClientHit;

/** True when the query can show a yellow highlight on a displayed client field. */
export function clientHasVisibleMatch(
  client: ClientSearchResult,
  query: string,
) {
  return (
    fieldMatches(client.name, query) ||
    fieldMatches(client.tradingName, query) ||
    fieldMatches(client.abn, query) ||
    fieldMatches(client.phone, query) ||
    fieldMatches(client.email, query) ||
    fieldMatches(client.accountManagerName, query) ||
    fieldMatches(client.arCompanyName, query) ||
    fieldMatches(client.arName, query)
  );
}
