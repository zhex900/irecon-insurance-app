import {
  BoldIcon,
  BringToFrontIcon,
  Columns3Icon,
  DropletOffIcon,
  MinusIcon,
  PlusIcon,
  SendToBackIcon,
  UnfoldVerticalIcon,
} from "lucide-react";
import type { TableColumnDraft } from "~/components/documents/pdfme-designer-helpers";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type PdfmeDesignerSelectionToolbarProps = {
  selectionCount: number;
  textSelected: boolean;
  tableSelected: boolean;
  endorsementPairSelected: boolean;
  heightMm: string;
  yGapMm: string;
  endorsementBlockGapMm: string;
  tableColumns: TableColumnDraft[];
  onHeightMmChange: (value: string) => void;
  onYGapMmChange: (value: string) => void;
  onEndorsementBlockGapMmChange: (value: string) => void;
  onBold: (bold: boolean) => void;
  onTransparentBackground: () => void;
  onZOrder: (direction: "front" | "back" | "forward" | "backward") => void;
  onSetHeight: () => void;
  onSpaceVertically: () => void;
  onSetEndorsementBlockGap: () => void;
  onTableColumnHeadChange: (index: number, value: string) => void;
  onTableColumnWidthChange: (index: number, value: string) => void;
  onRemoveTableColumn: (index: number) => void;
  onAddTableColumn: () => void;
  onApplyTableColumns: () => void;
};

export function PdfmeDesignerSelectionToolbar({
  selectionCount,
  textSelected,
  tableSelected,
  endorsementPairSelected,
  heightMm,
  yGapMm,
  endorsementBlockGapMm,
  tableColumns,
  onHeightMmChange,
  onYGapMmChange,
  onEndorsementBlockGapMmChange,
  onBold,
  onTransparentBackground,
  onZOrder,
  onSetHeight,
  onSpaceVertically,
  onSetEndorsementBlockGap,
  onTableColumnHeadChange,
  onTableColumnWidthChange,
  onRemoveTableColumn,
  onAddTableColumn,
  onApplyTableColumns,
}: PdfmeDesignerSelectionToolbarProps) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5">
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        {selectionCount} selected
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!textSelected}
        onClick={() => onBold(true)}
        title="Make selected text bold"
      >
        <BoldIcon data-icon="inline-start" />
        Bold
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!textSelected}
        onClick={() => onBold(false)}
        title="Make selected text regular"
      >
        Regular
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onTransparentBackground}
        title="Clear fill / background on selected elements"
      >
        <DropletOffIcon data-icon="inline-start" />
        Transparent
      </Button>
      <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onZOrder("back")}
        title="Send selected elements behind all others"
      >
        <SendToBackIcon data-icon="inline-start" />
        Back
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onZOrder("front")}
        title="Bring selected elements in front of all others"
      >
        <BringToFrontIcon data-icon="inline-start" />
        Front
      </Button>
      <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor="bulk-height">
          Height (mm)
        </label>
        <Input
          id="bulk-height"
          type="number"
          min={0.5}
          step={0.5}
          value={heightMm}
          onChange={(event) => onHeightMmChange(event.target.value)}
          className="h-7 w-16 text-xs"
          aria-label="Height in mm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSetHeight}
          title="Set height on all selected"
        >
          Set height
        </Button>
      </div>
      <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor="bulk-y-gap">
          Y gap (mm)
        </label>
        <Input
          id="bulk-y-gap"
          type="number"
          min={0}
          step={0.5}
          value={yGapMm}
          onChange={(event) => onYGapMmChange(event.target.value)}
          className="h-7 w-16 text-xs"
          aria-label="Y gap in mm"
          disabled={selectionCount < 2}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selectionCount < 2}
          onClick={onSpaceVertically}
          title="Set Y positions from the first selected field: Y, Y+gap, Y+2×gap…"
        >
          <UnfoldVerticalIcon data-icon="inline-start" />
          Set Y gap
        </Button>
      </div>
      {endorsementPairSelected ? (
        <>
          <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
          <div className="flex items-center gap-1">
            <label className="sr-only" htmlFor="endorsement-block-gap">
              Endorsement block gap (mm)
            </label>
            <Input
              id="endorsement-block-gap"
              type="number"
              min={0}
              step={0.5}
              value={endorsementBlockGapMm}
              onChange={(event) =>
                onEndorsementBlockGapMmChange(event.target.value)
              }
              className="h-7 w-16 text-xs"
              aria-label="Endorsement block gap in mm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSetEndorsementBlockGap}
              title="Space between each endorsement block when the list is generated"
            >
              Block gap
            </Button>
          </div>
        </>
      ) : null}
      {tableSelected ? (
        <>
          <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1 text-xs text-muted-foreground">
              <Columns3Icon className="size-3.5" />
              Columns
            </span>
            {tableColumns.map((col, index) => (
              <div
                key={`table-col-${index}`}
                className="flex items-center gap-1 rounded-md border bg-background px-1 py-0.5"
              >
                <Input
                  value={col.head}
                  onChange={(event) =>
                    onTableColumnHeadChange(index, event.target.value)
                  }
                  className="h-7 w-24 text-xs"
                  aria-label={`Column ${index + 1} name`}
                  placeholder={`Column ${index + 1}`}
                />
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={col.widthPct}
                  onChange={(event) =>
                    onTableColumnWidthChange(index, event.target.value)
                  }
                  className="h-7 w-14 text-xs"
                  aria-label={`Column ${index + 1} width percent`}
                  title="Width %"
                />
                <span className="pr-0.5 text-[10px] text-muted-foreground">
                  %
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={tableColumns.length <= 1}
                  onClick={() => onRemoveTableColumn(index)}
                  title={`Remove column ${index + 1}`}
                >
                  <MinusIcon className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddTableColumn}
              title="Add column"
            >
              <PlusIcon data-icon="inline-start" />
              Col
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onApplyTableColumns}
              title="Apply column names and widths (normalized to 100%)"
            >
              Apply columns
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
