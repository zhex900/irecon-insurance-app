/** Stable cache key for policy list stats fetcher (filters + search, not page). */
export function policyListStatsKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams);
  params.delete("page");
  params.delete("pageSize");
  return params.toString();
}

/** Build `/api/policies/list-stats` URL (pagination omitted). */
export function buildPolicyListStatsUrl(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams);
  params.delete("page");
  params.delete("pageSize");
  const qs = params.toString();
  return qs ? `/api/policies/list-stats?${qs}` : "/api/policies/list-stats";
}
