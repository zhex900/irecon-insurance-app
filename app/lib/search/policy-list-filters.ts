import {
  dateRangeActive,
  resolveExpiryRange,
  resolveInceptionRange,
  type DateRangeValue,
} from "~/lib/search/date-range-filter";
import {
  formatIdListParam,
  parseIdListParam,
} from "~/lib/search/id-list-param";

export type PolicyListUrlFilters = {
  q: string;
  statusIds: number[];
  coverTypeIds: number[];
  policyCategoryIds: number[];
  clientIds: number[];
  inception: DateRangeValue;
  expiry: DateRangeValue;
};

export function parsePolicyListFiltersFromUrl(url: URL): PolicyListUrlFilters {
  return {
    q: url.searchParams.get("q") ?? "",
    statusIds: parseIdListParam(url.searchParams.get("status")),
    coverTypeIds: parseIdListParam(url.searchParams.get("cover")),
    policyCategoryIds: parseIdListParam(url.searchParams.get("category")),
    clientIds: parseIdListParam(url.searchParams.get("client")),
    inception: resolveInceptionRange({
      preset: url.searchParams.get("inception"),
      from: url.searchParams.get("inceptionFrom"),
      to: url.searchParams.get("inceptionTo"),
    }),
    expiry: resolveExpiryRange({
      preset: url.searchParams.get("expiry"),
      from: url.searchParams.get("expiryFrom"),
      to: url.searchParams.get("expiryTo"),
    }),
  };
}

export function policyListFiltersKey(filters: PolicyListUrlFilters): string {
  return [
    filters.statusIds.join(","),
    filters.coverTypeIds.join(","),
    filters.policyCategoryIds.join(","),
    filters.clientIds.join(","),
    filters.inception.preset ?? "",
    filters.inception.from ?? "",
    filters.inception.to ?? "",
    filters.expiry.preset ?? "",
    filters.expiry.from ?? "",
    filters.expiry.to ?? "",
  ].join("|");
}

/** Apply multi-select column filter IDs to the current search params. */
export function withIdListParam(
  params: URLSearchParams,
  key: "status" | "cover" | "category" | "client",
  nextIds: number[],
): URLSearchParams {
  const next = new URLSearchParams(params);
  const encoded = formatIdListParam(nextIds);
  if (encoded) next.set(key, encoded);
  else next.delete(key);
  next.delete("page");
  return next;
}

/** Apply inception/expiry date-range filter to the current search params. */
export function withDateRangeParam(
  params: URLSearchParams,
  key: "inception" | "expiry",
  next: DateRangeValue,
): URLSearchParams {
  const result = new URLSearchParams(params);
  const fromKey = `${key}From`;
  const toKey = `${key}To`;
  if (next.preset) {
    result.set(key, next.preset);
    result.delete(fromKey);
    result.delete(toKey);
  } else if (dateRangeActive(next)) {
    result.delete(key);
    if (next.from) result.set(fromKey, next.from);
    else result.delete(fromKey);
    if (next.to) result.set(toKey, next.to);
    else result.delete(toKey);
  } else {
    result.delete(key);
    result.delete(fromKey);
    result.delete(toKey);
  }
  result.delete("page");
  return result;
}
