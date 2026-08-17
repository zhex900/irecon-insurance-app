import { useEffect, useRef } from "react";
import type { useFetcher } from "react-router";
import { toast } from "sonner";

import type { PolicyWizardActionData } from "~/components/policies/wizard/hooks/premium/use-premium-calculation";
import type { Policy } from "~/lib/db/types";

/** Apply save action JSON to local policy state — avoids full loader revalidation. */
export function usePolicySaveSync({
  fetcher,
  onPolicyUpdated,
  onSubmitted,
}: {
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  onPolicyUpdated?: (policy: Policy) => void;
  /** Pin premium / treat as submitted when the saved policy is no longer a draft. */
  onSubmitted?: () => void;
}) {
  const handledRef = useRef<unknown>(null);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.intent !== "save") return;
    if (!fetcher.data.ok || !fetcher.data.policy) return;
    if (handledRef.current === fetcher.data) return;
    handledRef.current = fetcher.data;
    onPolicyUpdated?.(fetcher.data.policy);
    if (!fetcher.data.policy.isDraft) {
      onSubmitted?.();
    }
    if (fetcher.data.message) {
      toast.success(fetcher.data.message);
    }
  }, [fetcher.state, fetcher.data, onPolicyUpdated, onSubmitted]);
}
