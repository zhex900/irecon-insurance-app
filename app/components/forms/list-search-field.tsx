import { XIcon } from "lucide-react";

import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

/** Shared list-page search field: clear button, consistent width/padding. */
export function ListSearchField({
  value,
  onChange,
  onClear,
  placeholder,
  "aria-label": ariaLabel,
  id,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Defaults to `onChange("")` when omitted. */
  onClear?: () => void;
  placeholder: string;
  "aria-label": string;
  id?: string;
  className?: string;
  inputClassName?: string;
}) {
  const trimmed = value.trim();
  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn("w-full", trimmed && "pr-9", inputClassName)}
        aria-label={ariaLabel}
      />
      {trimmed ? (
        <button
          type="button"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
          onClick={() => {
            if (onClear) onClear();
            else onChange("");
          }}
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
