/** Stable cache key for list secondary fetcher (filters + search, not page). */
export function policyListMetaKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams);
  params.delete("page");
  params.delete("pageSize");
  return params.toString();
}
