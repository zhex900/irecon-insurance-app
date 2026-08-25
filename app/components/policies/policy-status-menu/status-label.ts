import type { PolicyStatusOption } from "./types";

export function statusLabel(
  statuses: PolicyStatusOption[],
  statusId: number | null,
): string | null {
  if (statusId == null) return null;
  return (
    statuses.find((status) => status.policyStatusId === statusId)?.name ?? null
  );
}
