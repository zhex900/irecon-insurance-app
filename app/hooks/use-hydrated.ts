import * as React from "react";

function subscribeNever() {
  return () => {};
}

/** True after the client has hydrated — use to defer Base UI / browser-only UI. */
export function useHydrated() {
  return React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
