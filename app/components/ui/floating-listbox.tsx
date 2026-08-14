import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";

export type FloatingListPosition = {
  top: number;
  left: number;
  width: number;
};

/**
 * Tracks the screen position for a floating listbox anchored below `anchorRef`
 * (portal-rendered combobox results). Shared by every autocomplete-style input
 * that positions a `fixed` listbox via `getBoundingClientRect` instead of CSS
 * anchoring, so the resize/scroll wiring lives in one place.
 */
export function useFloatingListPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  recomputeKey: number | string,
  minWidth = 0,
): FloatingListPosition | null {
  const [position, setPosition] = useState<FloatingListPosition | null>(null);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, minWidth),
    });
  }, [anchorRef, minWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, recomputeKey, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onReposition() {
      updatePosition();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  return position;
}

/** Portal-rendered `role="listbox"` positioned via `useFloatingListPosition`. */
export function FloatingListbox({
  id,
  open,
  position,
  children,
  className,
}: {
  id: string;
  open: boolean;
  position: FloatingListPosition | null;
  children: ReactNode;
  className?: string;
}) {
  if (!open || !position || typeof document === "undefined") return null;
  return createPortal(
    <ul
      id={id}
      role="listbox"
      className={cn(
        "fixed z-50 max-h-56 overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md",
        className,
      )}
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      {children}
    </ul>,
    document.body,
  );
}
