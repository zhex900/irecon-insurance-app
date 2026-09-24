import { WORKER_TO_WORKER_TURNOVER_THRESHOLD } from "~/constants";
import { stripAmountCommas } from "~/lib/amount-input";

const WORKER_TO_WORKER_EXCESS_UP_TO_THRESHOLD = "15000";
const WORKER_TO_WORKER_EXCESS_ABOVE_THRESHOLD = "25000";

/** Worker-to-Worker excess from estimated turnover; null when turnover is unset. */
export function resolveWorkerToWorkerExcess(
  estimatedTurnover: unknown,
): string | null {
  const raw = stripAmountCommas(estimatedTurnover);
  if (raw === "" || raw == null) return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value <= WORKER_TO_WORKER_TURNOVER_THRESHOLD) {
    return WORKER_TO_WORKER_EXCESS_UP_TO_THRESHOLD;
  }
  return WORKER_TO_WORKER_EXCESS_ABOVE_THRESHOLD;
}
