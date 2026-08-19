import { WifiOffIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useNetworkStatus } from "~/hooks/network";
import { cn } from "~/lib/utils";

/** Global dialog when the browser or reachability check reports no connection. */
export function OfflineDialog() {
  const { isOffline } = useNetworkStatus();

  return (
    <Dialog open={isOffline}>
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
            <WifiOffIcon className="size-12 text-destructive motion-safe:animate-pulse" />
          </div>

          <DialogHeader className="max-w-md place-items-center gap-3 text-center">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              No internet connection
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-foreground/80">
              You are offline. Check your Wi‑Fi or mobile data, then wait a
              moment — this message will disappear automatically when you are
              back online.
            </DialogDescription>
          </DialogHeader>

          <p className="mt-8 max-w-sm text-sm font-medium text-destructive">
            Unsaved changes cannot be synced until your connection returns.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
