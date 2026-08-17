/** Build `/api/policies/list-meta` URL from list search params (pagination omitted). */
export function buildPolicyListMetaUrl(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams);
  params.delete("page");
  params.delete("pageSize");
  const qs = params.toString();
  return qs
    ? `/api/policies/list-meta?${qs}`
    : "/api/policies/list-meta";
}

/** Stable cache key for meta fetcher (filters + search, not page). */
export function policyListMetaKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams);
  params.delete("page");
  params.delete("pageSize");
  return params.toString();
}
