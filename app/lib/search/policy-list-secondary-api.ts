/** Build `/api/policies/list-secondary` URL (pagination omitted). */
export function buildPolicyListSecondaryUrl(
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams(searchParams);
  params.delete("page");
  params.delete("pageSize");
  const qs = params.toString();
  return qs
    ? `/api/policies/list-secondary?${qs}`
    : "/api/policies/list-secondary";
}

export { policyListMetaKey } from "~/lib/search/policy-list-meta-api";
