import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { useHydrated } from "~/hooks/network";
import type { AccountManager, WholesaleBroker } from "~/lib/db/types";
import type { EmailDirectoryEntry } from "~/lib/email/directory";
import type { EmailTemplate } from "~/lib/email/templates";

export type PolicyEmailComposeData = {
  templates: EmailTemplate[];
  footerImageDataUri: string;
  footerImageWidth: number;
  broker: WholesaleBroker | null;
  accountManager: AccountManager | null;
  directory: EmailDirectoryEntry[];
};

/** Email dialog payload — fetched when the user opens Send email. */
export function usePolicyEmailCompose(policyId: string, enabled: boolean) {
  const hydrated = useHydrated();
  const fetcher = useFetcher<PolicyEmailComposeData>();
  const loadRef = useRef(fetcher.load);
  const [loadedPolicyId, setLoadedPolicyId] = useState<string | null>(null);
  const [prevPolicyId, setPrevPolicyId] = useState(policyId);

  useEffect(() => {
    loadRef.current = fetcher.load;
  });

  if (policyId !== prevPolicyId) {
    setPrevPolicyId(policyId);
    setLoadedPolicyId(null);
  }

  if (
    fetcher.state === "idle" &&
    fetcher.data &&
    policyId &&
    loadedPolicyId !== policyId
  ) {
    setLoadedPolicyId(policyId);
  }

  const compose =
    fetcher.data && fetcher.state === "idle" && loadedPolicyId === policyId
      ? fetcher.data
      : null;
  const pending = enabled && !compose;

  useEffect(() => {
    if (!enabled || !policyId || !hydrated || compose) return;
    if (fetcher.state !== "idle") return;
    loadRef.current(`/api/policies/${policyId}/email-compose`);
  }, [enabled, policyId, hydrated, compose, fetcher.state]);

  return { compose, pending };
}
