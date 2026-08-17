import { type KeyboardEvent, type ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Must not be a <button>/<input>: premium sits in a disabled fieldset when the
 * policy is view-only, and native form controls inside that fieldset ignore clicks.
 */
export function PremiumExplainTrigger({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClick();
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-4 translate-y-px cursor-pointer items-center justify-center rounded-full align-text-bottom outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </span>
  );
}
