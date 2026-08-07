import * as React from "react";
import { useNavigation } from "react-router";
import { cn } from "~/lib/utils";

/** Wait this long after navigation starts before showing (avoids flash on instant loads). */
const SHOW_DELAY_MS = 130;
/** Once shown, keep the bar up at least this long after navigation finishes. */
const MIN_VISIBLE_MS = 1000;

/**
 * Thin top progress bar while React Router is navigating or submitting.
 *
 * Activated by: any in-app Link click, `navigate()`, or Form submit —
 * whenever `useNavigation().state` is `"loading"` or `"submitting"`.
 * Not activated by fetcher-only requests (those use LoadingButton / local spinners).
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";
  const [visible, setVisible] = React.useState(false);
  const shownAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (pending) {
      const showId = window.setTimeout(() => {
        setVisible(true);
        shownAtRef.current = Date.now();
      }, SHOW_DELAY_MS);
      return () => window.clearTimeout(showId);
    }

    // Navigation finished — hold for remaining min-visible time, then hide.
    if (shownAtRef.current == null) {
      setVisible(false);
      return;
    }
    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const hideId = window.setTimeout(() => {
      setVisible(false);
      shownAtRef.current = null;
    }, remaining);
    return () => window.clearTimeout(hideId);
  }, [pending]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div
        className={cn(
          "h-full w-1/3 rounded-full bg-primary",
          "animate-nav-progress motion-reduce:animate-none",
        )}
      />
    </div>
  );
}
