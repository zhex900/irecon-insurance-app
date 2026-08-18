import { getAppRelease } from "~/lib/app-version";

export type ReferenceSessionCacheKind =
  "list-reference" | "car-wording" | "policy-fee-names";

export const listReferenceSessionCacheKey = () =>
  `list-reference:${getAppRelease()}`;

export const carWordingSessionCacheKey = () => `car-wording:${getAppRelease()}`;

export const policyFeeNamesSessionCacheKey = (asOf: string) =>
  `policy-fee-names:${getAppRelease()}:${asOf}`;

const policyFeeNamesSessionCachePrefix = () =>
  `policy-fee-names:${getAppRelease()}:`;

const generations: Record<ReferenceSessionCacheKind, number> = {
  "list-reference": 0,
  "car-wording": 0,
  "policy-fee-names": 0,
};

const listeners = new Map<ReferenceSessionCacheKind, Set<() => void>>();

function removeSessionStorageKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Private browsing / disabled storage — ignore.
  }
}

function removeSessionStorageByPrefix(prefix: string) {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // Private browsing / disabled storage — ignore.
  }
}

function bump(kind: ReferenceSessionCacheKind) {
  generations[kind] += 1;
  listeners.get(kind)?.forEach((listener) => listener());
}

export function getReferenceSessionCacheGeneration(
  kind: ReferenceSessionCacheKind,
) {
  return generations[kind];
}

export function subscribeReferenceSessionCacheInvalidation(
  kind: ReferenceSessionCacheKind,
  callback: () => void,
) {
  const set = listeners.get(kind) ?? new Set();
  set.add(callback);
  listeners.set(kind, set);
  return () => {
    set.delete(callback);
  };
}

/** Drop cached list AM + AR after Settings → Account Managers / AR changes. */
export function invalidateListReferenceSessionCache() {
  removeSessionStorageKey(listReferenceSessionCacheKey());
  bump("list-reference");
}

/** Drop cached CAR wording after Settings → Additional Wording changes. */
export function invalidateCarWordingSessionCache() {
  removeSessionStorageKey(carWordingSessionCacheKey());
  bump("car-wording");
}

/** Drop cached broker fee lines after Settings → Prices → Broker fees changes. */
export function invalidatePolicyFeeNamesSessionCache() {
  removeSessionStorageByPrefix(policyFeeNamesSessionCachePrefix());
  bump("policy-fee-names");
}
