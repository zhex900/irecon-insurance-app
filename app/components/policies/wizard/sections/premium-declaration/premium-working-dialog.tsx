import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { PencilIcon, XIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "~/components/ui/dialog";
import type { PremiumLineWorking } from "~/lib/pricing/premium-workings";
import { cn, formatCurrency } from "~/lib/utils";

function ManualAdjustmentBanner({ working }: { working: PremiumLineWorking }) {
  if (!working.manual) return null;
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <PencilIcon className="size-3.5" aria-hidden />
        Manually adjusted
      </p>
      <p className="mt-1 text-xs text-warning/90">
        Calculated {formatCurrency(working.calculated)} · Current{" "}
        {formatCurrency(working.current)}
      </p>
    </div>
  );
}

function WorkingSteps({ steps }: { steps: PremiumLineWorking["steps"] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((item, index) => (
        <li
          key={`${item.label}-${index}`}
          className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
        >
          <span className="text-muted-foreground">{item.label}</span>
          {item.detail ? (
            <span className="text-right font-medium break-all tabular-nums">
              {item.detail}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function PremiumWorkingDialog({
  working,
  onOpenChange,
}: {
  working: PremiumLineWorking | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={working != null} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40 supports-backdrop-filter:backdrop-blur-md" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-lg",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          {working ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{working.title}</DialogTitle>
              </DialogHeader>
              <ManualAdjustmentBanner working={working} />
              <WorkingSteps steps={working.steps} />
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    className="absolute top-2 right-2"
                    size="icon-sm"
                  />
                }
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </DialogClose>
            </>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
