import { useEffect, useMemo, useRef, useState } from "react";
import { useActionData, useNavigation } from "react-router";

import type { DeletablePolicyRef } from "~/components/policies/delete-policies-dialog";
import { useHandledActionData } from "~/hooks/utilities";
import type { PolicyListItem } from "~/lib/services/policies/list.service";
import { isTerminalStatus } from "~/lib/zod/policy-car";

type DeletePoliciesActionData =
  | { ok: true; intent: string; count?: number; message?: string }
  | { ok: false; error: string };

export type PolicyListSelection = ReturnType<typeof usePolicyListSelection>;

export function usePolicyListSelection({
  policies,
  syncKey,
  deleteIntent,
}: {
  policies: PolicyListItem[];
  /** Changes when filters, search, or page change — clears row selection. */
  syncKey: string;
  deleteIntent: string;
}) {
  const navigation = useNavigation();
  const actionData = useActionData() as DeletePoliciesActionData | undefined;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<
    DeletablePolicyRef[] | null
  >(null);

  const lastSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSyncKeyRef.current === syncKey) return;
    lastSyncKeyRef.current = syncKey;
    setSelectedIds([]);
  }, [syncKey]);

  useHandledActionData(actionData, {
    waitForIdle: false,
    intents: deleteIntent,
    onSuccess: () => {
      setPendingDelete(null);
      setSelectedIds([]);
    },
  });

  const deletableOnPage = useMemo(
    () => policies.filter((policy) => !isTerminalStatus(policy.policyStatusId)),
    [policies],
  );

  const allDeletableSelected =
    deletableOnPage.length > 0 &&
    deletableOnPage.every((policy) => selectedIds.includes(policy.policyId));

  const selectedPolicies = useMemo(
    () =>
      policies
        .filter((policy) => selectedIds.includes(policy.policyId))
        .map((policy) => ({
          policyId: policy.policyId,
          policyNumber: policy.policyNumber,
        })),
    [policies, selectedIds],
  );

  const deletingInFlight =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === deleteIntent;

  function toggleSelected(policyId: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked
        ? prev.includes(policyId)
          ? prev
          : [...prev, policyId]
        : prev.filter((id) => id !== policyId),
    );
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter(
          (id) => !deletableOnPage.some((policy) => policy.policyId === id),
        ),
      );
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const policy of deletableOnPage) next.add(policy.policyId);
      return [...next];
    });
  }

  return {
    selectedIds,
    setSelectedIds,
    pendingDelete,
    setPendingDelete,
    deletableOnPage,
    allDeletableSelected,
    selectedPolicies,
    toggleSelected,
    toggleSelectAll,
    deletingInFlight,
    actionData,
  };
}
