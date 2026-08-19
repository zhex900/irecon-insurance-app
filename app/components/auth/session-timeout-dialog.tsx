import { LogInIcon } from "lucide-react";
import * as React from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import {
  evaluateSessionTimeout,
  type SessionTimeoutClientState,
} from "~/lib/auth/session";
import { cn } from "~/lib/utils";

const CHECK_INTERVAL_MS = 5_000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

/**
 * When idle / absolute session limits elapse, block the shell and ask the user
 * to sign in again (before the next navigation hard-redirects to /login).
 */
export function SessionTimeoutDialog({
  config,
}: {
  config: SessionTimeoutClientState | null;
}) {
  const logoutFetcher = useFetcher();
  const signingIn = logoutFetcher.state !== "idle";
  const [expiredReason, setExpiredReason] = React.useState<
    "inactivity" | "absolute" | null
  >(null);
  const [lastActivityAtMs, setLastActivityAtMs] = React.useState(
    () => config?.lastActivityAtMs ?? 0,
  );
  const clockOffsetRef = React.useRef(0);
  const expiredRef = React.useRef(false);

  // `config` is a fresh object on nearly every render — the shell loader
  // reruns on most navigations — so resetting on its identity would reset
  // the idle clock on unrelated page loads. `startedAtMs` only changes when
  // the broker actually signs in again, so key the reset off that instead.
  // Resetting during render (rather than in an effect) avoids a disallowed
  // synchronous setState-in-effect and the extra commit it would cause.
  const [prevSessionStartedAtMs, setPrevSessionStartedAtMs] = React.useState(
    config?.startedAtMs ?? null,
  );
  if ((config?.startedAtMs ?? null) !== prevSessionStartedAtMs) {
    setPrevSessionStartedAtMs(config?.startedAtMs ?? null);
    if (config) setLastActivityAtMs(config.lastActivityAtMs);
    setExpiredReason(null);
  }

  React.useEffect(() => {
    if (!config) return;
    clockOffsetRef.current = config.serverNowMs - Date.now();
    expiredRef.current = false;
  }, [config]);

  React.useEffect(() => {
    expiredRef.current = expiredReason != null;
  }, [expiredReason]);

  const nowMs = React.useCallback(
    () => Date.now() + clockOffsetRef.current,
    [],
  );

  React.useEffect(() => {
    if (!config || expiredReason) return;

    const onActivity = () => {
      if (expiredRef.current) return;
      setLastActivityAtMs(nowMs());
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") onActivity();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [config, expiredReason, nowMs]);

  React.useEffect(() => {
    if (!config || expiredReason) return;

    const tick = () => {
      const verdict = evaluateSessionTimeout(
        {
          startedAtMs: config.startedAtMs,
          lastActivityAtMs,
        },
        {
          inactivityMs: config.inactivityMs,
          absoluteMs: config.absoluteMs,
          activityRefreshMs: 60_000,
        },
        nowMs(),
      );
      if (!verdict.ok) {
        setExpiredReason(verdict.reason);
      }
    };

    tick();
    const id = window.setInterval(tick, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [config, expiredReason, lastActivityAtMs, nowMs]);

  if (!config) return null;

  const open = expiredReason != null;
  const title =
    expiredReason === "absolute"
      ? "Session expired"
      : "Signed out due to inactivity";
  const description =
    expiredReason === "absolute"
      ? "Your session has reached its time limit. Sign in again to continue working."
      : "You were inactive for too long. Sign in again to continue working.";
  const loginReason = expiredReason === "absolute" ? "expired" : "idle";

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* Non-dismissible — must sign in again */
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/55 supports-backdrop-filter:backdrop-blur-sm"
        className={cn(
          "gap-0 overflow-hidden border-2 border-destructive/35 p-0 sm:max-w-xl",
          "shadow-2xl ring-4 ring-destructive/15",
        )}
      >
        <div className="flex flex-col items-center px-8 py-10 text-center">
          <div
            className="mb-6 flex size-24 items-center justify-center rounded-full bg-destructive/15 ring-8 ring-destructive/10"
            aria-hidden
          >
            <LogInIcon className="size-12 text-destructive" />
          </div>

          <DialogHeader className="max-w-md place-items-center gap-3 text-center">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-foreground/80">
              {description}
            </DialogDescription>
          </DialogHeader>

          <Button
            type="button"
            className="mt-8 min-w-44"
            disabled={signingIn}
            onClick={() => {
              void logoutFetcher.submit(null, {
                method: "post",
                action: `/logout?reason=${loginReason}`,
              });
            }}
          >
            {signingIn ? <Spinner /> : <LogInIcon />}
            {signingIn ? "Redirecting…" : "Sign in again"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
