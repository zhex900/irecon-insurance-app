import { useMemo, useRef, useState } from "react";

import { HighlightText } from "~/components/search/highlight";
import {
  FloatingListbox,
  useFloatingListPosition,
} from "~/components/ui/floating-listbox";
import { Input } from "~/components/ui/input";
import {
  EMAIL_DIRECTORY_KIND_LABEL,
  type EmailDirectoryEntry,
} from "~/lib/email/directory";
import { cn } from "~/lib/utils";

/** Head (completed addresses + separator) and the fragment currently being typed. */
function splitDraft(value: string): { head: string; draft: string } {
  const lastSep = Math.max(value.lastIndexOf(";"), value.lastIndexOf(","));
  if (lastSep < 0) return { head: "", draft: value };
  return {
    head: value.slice(0, lastSep + 1),
    draft: value.slice(lastSep + 1).replace(/^\s+/, ""),
  };
}

function replaceDraftWithEmail(value: string, email: string): string {
  const { head } = splitDraft(value);
  const prefix = head.trimEnd();
  if (!prefix) return `${email}; `;
  return `${prefix} ${email}; `;
}

export function EmailRecipientsInput({
  id,
  value,
  onChange,
  options,
  placeholder = "name@example.com; …",
  className,
  "aria-label": ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: EmailDirectoryEntry[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<number | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const draft = splitDraft(value).draft;
  const draftLower = draft.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!draftLower) return [];
    return options
      .filter((item) => {
        const haystack =
          `${item.email} ${item.name} ${EMAIL_DIRECTORY_KIND_LABEL[item.kind]}`.toLowerCase();
        return haystack.includes(draftLower);
      })
      .slice(0, 40);
  }, [options, draftLower]);

  const position = useFloatingListPosition(
    anchorRef,
    open,
    filtered.length,
    280,
  );

  function selectEntry(entry: EmailDirectoryEntry) {
    onChange(replaceDraftWithEmail(value, entry.email));
    setOpen(false);
    setHighlight(0);
  }

  const listbox =
    filtered.length > 0 ? (
      <FloatingListbox id={`${id}-listbox`} open={open} position={position}>
        {filtered.map((item, index) => {
          const active = index === highlight;
          return (
            <li key={`${item.kind}:${item.email}`} role="option">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start rounded-md px-2.5 py-2 text-left hover:bg-muted",
                  active && "bg-muted",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => selectEntry(item)}
              >
                <span className="font-medium">
                  <HighlightText text={item.email} query={draftLower} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.name ? (
                    <>
                      <HighlightText text={item.name} query={draftLower} />
                      {" · "}
                      {EMAIL_DIRECTORY_KIND_LABEL[item.kind]}
                    </>
                  ) : (
                    EMAIL_DIRECTORY_KIND_LABEL[item.kind]
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </FloatingListbox>
    ) : null;

  return (
    <div ref={anchorRef} className="min-w-0 flex-1">
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current);
        }}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          const nextDraft = splitDraft(next).draft.trim();
          setOpen(nextDraft.length > 0);
          setHighlight(0);
        }}
        onKeyDown={(event) => {
          if (!open || filtered.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((i) => (i + 1) % filtered.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((i) => (i - 1 + filtered.length) % filtered.length);
            return;
          }
          if (event.key === "Enter" && draft.trim()) {
            const match = filtered[highlight];
            if (!match) return;
            event.preventDefault();
            selectEntry(match);
            return;
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
        className={cn(
          "rounded-none border-0 px-0 shadow-none focus-visible:ring-0",
          className,
        )}
      />
      {listbox}
    </div>
  );
}
