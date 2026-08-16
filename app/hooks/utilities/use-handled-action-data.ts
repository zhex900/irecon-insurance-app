import { useEffect, useRef } from "react";
import { useNavigation } from "react-router";

export type HandledActionData = {
  ok?: boolean;
  intent?: string;
};

export type UseHandledActionDataOptions<T extends HandledActionData> = {
  /** When false, success handling is paused (e.g. dialog closed). Default true. */
  enabled?: boolean;
  /** Wait for navigation.state === "idle" before handling. Default true. */
  waitForIdle?: boolean;
  /** Require actionData.ok === true. Default true. */
  requireOk?: boolean;
  /** When set, only handle matching intent(s). */
  intents?: string | readonly string[];
  onSuccess: (actionData: T) => void;
};

/**
 * Run a callback once per new action result. Tracks the last handled actionData
 * so stale results do not re-run after dialogs reopen or filters change.
 */
export function useHandledActionData<T extends HandledActionData>(
  actionData: T | undefined,
  {
    enabled = true,
    waitForIdle = true,
    requireOk = true,
    intents,
    onSuccess,
  }: UseHandledActionDataOptions<T>,
) {
  const navigation = useNavigation();
  const handledRef = useRef(actionData);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const intentsKey =
    intents === undefined
      ? undefined
      : typeof intents === "string"
        ? intents
        : intents.join("\0");

  useEffect(() => {
    if (!enabled) return;
    if (waitForIdle && navigation.state !== "idle") return;
    if (handledRef.current === actionData) return;
    handledRef.current = actionData;
    const handled = handledRef.current;
    if (!handled) return;
    if (requireOk && !handled.ok) return;
    if (intentsKey !== undefined) {
      const allowed = intentsKey.split("\0");
      if (!handled.intent || !allowed.includes(handled.intent)) return;
    }
    onSuccessRef.current(handled);
  }, [
    actionData,
    enabled,
    intentsKey,
    navigation.state,
    requireOk,
    waitForIdle,
  ]);
}
