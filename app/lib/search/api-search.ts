import type {
  GlobalSearchClientHit,
  GlobalSearchPolicyHit,
} from "~/lib/services/search/global-search.service";

export type GlobalSearchApiResponse = {
  clients: GlobalSearchClientHit[];
  policies: GlobalSearchPolicyHit[];
  clientTotal?: number;
  policyTotal?: number;
  total?: number;
};

export type ClientsSearchApiResponse = {
  clients: GlobalSearchClientHit[];
  total?: number;
};

export const GLOBAL_SEARCH_PARAMS = { limit: 8 } as const;

export const CLIENT_PICKER_SEARCH_PARAMS = {
  type: "clients",
  limit: 25,
} as const;

export const CLIENT_FILTER_SEARCH_PARAMS = {
  type: "clients",
  limit: 20,
} as const;

export function buildApiSearchUrl(
  q: string,
  extra?: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();
  params.set("q", q);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) params.set(key, String(value));
    }
  }
  return `/api/search?${params.toString()}`;
}
