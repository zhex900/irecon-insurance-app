import { BracesIcon, SearchIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

type PdfmeDesignerMergePanelProps = {
  editable: boolean;
  status: "loading" | "ready" | "error";
  mergePanelOpen: boolean;
  onTogglePanel: () => void;
  fieldQuery: string;
  onFieldQueryChange: (value: string) => void;
  filteredFields: readonly string[];
  usedFieldNames: Set<string>;
  onAddMergeField: (fieldName: string) => void;
};

export function MergePanel({
  editable,
  status,
  mergePanelOpen,
  onTogglePanel,
  fieldQuery,
  onFieldQueryChange,
  filteredFields,
  usedFieldNames,
  onAddMergeField,
}: PdfmeDesignerMergePanelProps) {
  if (!editable) return null;

  return (
    <div className="flex shrink-0">
      <div className="flex w-10 flex-col items-center gap-1 border-r bg-muted/30 py-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant={mergePanelOpen ? "secondary" : "ghost"}
                size="icon"
                className="size-8"
                aria-pressed={mergePanelOpen}
                aria-expanded={mergePanelOpen}
                aria-controls="merge-fields-panel"
                aria-label="Merge fields"
                onClick={onTogglePanel}
              />
            }
          >
            <BracesIcon className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="right">
            {mergePanelOpen ? "Hide merge fields" : "Show merge fields"}
          </TooltipContent>
        </Tooltip>
      </div>
      <aside
        id="merge-fields-panel"
        className={cn(
          "flex flex-col overflow-hidden border-r bg-muted/20 transition-[width] duration-200 ease-out",
          mergePanelOpen ? "w-56" : "w-0 border-r-0",
        )}
        aria-hidden={!mergePanelOpen}
      >
        <div className="flex h-full w-56 flex-col">
          <div className="border-b p-2">
            <p className="mb-1.5 px-0.5 text-xs font-medium text-foreground">
              Merge fields
            </p>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fieldQuery}
                onChange={(event) => onFieldQueryChange(event.target.value)}
                placeholder="Search fields…"
                className="h-8 pl-7 text-xs"
                aria-label="Search merge fields"
                tabIndex={mergePanelOpen ? 0 : -1}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {filteredFields.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No matching fields.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filteredFields.map((name) => {
                  const used = usedFieldNames.has(name);
                  return (
                    <li key={name}>
                      <button
                        type="button"
                        disabled={status !== "ready" || !mergePanelOpen}
                        onClick={() => onAddMergeField(name)}
                        title={
                          used
                            ? `Add another ${name} to the current page`
                            : `Add ${name} to the current page`
                        }
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          "disabled:pointer-events-none disabled:opacity-50",
                          used && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate font-mono">{name}</span>
                        {used ? (
                          <span className="ml-2 shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
                            on page
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
