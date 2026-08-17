import type { Blocker, NavigateFunction } from "react-router";

export function proceedOrNavigate(options: {
  blocker: Blocker;
  navigate: NavigateFunction;
  destination: string;
}): void {
  if (options.blocker.state === "blocked") {
    options.blocker.proceed();
    return;
  }
  options.navigate(options.destination);
}

export function resetBlockerIfNeeded(blocker: Blocker): void {
  if (blocker.state === "blocked") blocker.reset();
}

export function destinationFromBlocker(blocker: Blocker): string | null {
  if (blocker.state !== "blocked" || !blocker.location) return null;
  return `${blocker.location.pathname}${blocker.location.search}${blocker.location.hash}`;
}
