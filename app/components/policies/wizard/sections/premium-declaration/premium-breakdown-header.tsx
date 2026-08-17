import { FileSpreadsheetIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { CardAction } from "~/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

function ResetPremiumButton({
  isCalculating,
  onReset,
}: {
  isCalculating: boolean;
  onReset: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Reset premium"
            disabled={isCalculating}
            onClick={onReset}
          />
        }
      >
        <RotateCcwIcon className={cn(isCalculating && "animate-spin")} />
      </TooltipTrigger>
      <TooltipContent>
        Reset premium. Manual edits will be cleared.
      </TooltipContent>
    </Tooltip>
  );
}

function ExportExcelButton({
  isExportingExcel,
  onExportExcel,
}: {
  isExportingExcel: boolean;
  onExportExcel: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="button"
            tabIndex={isExportingExcel ? -1 : 0}
            aria-label="Export premium to Excel"
            aria-disabled={isExportingExcel || undefined}
            className={cn(
              "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background shadow-xs transition-colors outline-none",
              "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
              isExportingExcel &&
                "pointer-events-none cursor-default opacity-50",
            )}
            onClick={() => {
              if (isExportingExcel) return;
              onExportExcel();
            }}
            onKeyDown={(event) => {
              if (isExportingExcel) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onExportExcel();
            }}
          />
        }
      >
        <FileSpreadsheetIcon
          className={cn(
            "size-4 text-success",
            isExportingExcel && "animate-pulse",
          )}
        />
      </TooltipTrigger>
      <TooltipContent>
        Download Excel (regenerates when premium or inputs change)
      </TooltipContent>
    </Tooltip>
  );
}

export function PremiumBreakdownHeader({
  isCalculating,
  isExportingExcel,
  onResetPremium,
  onExportExcel,
}: {
  isCalculating: boolean;
  isExportingExcel: boolean;
  onResetPremium?: () => void;
  onExportExcel?: () => void;
}) {
  if (!onResetPremium && !onExportExcel) return null;
  return (
    <CardAction className="flex items-center gap-1.5 self-center justify-self-auto">
      {onResetPremium ? (
        <ResetPremiumButton
          isCalculating={isCalculating}
          onReset={onResetPremium}
        />
      ) : null}
      {onExportExcel ? (
        <ExportExcelButton
          isExportingExcel={isExportingExcel}
          onExportExcel={onExportExcel}
        />
      ) : null}
    </CardAction>
  );
}
