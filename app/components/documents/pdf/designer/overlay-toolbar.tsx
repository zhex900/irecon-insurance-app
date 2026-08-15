import { useCallback, useRef, useState } from "react";
import { GripVerticalIcon } from "lucide-react";
import { cn } from "~/lib/utils";

export function PdfmeDesignerOverlayToolbar({
  children,
}: {
  children: React.ReactNode;
}) {
  const overlayToolbarRef = useRef<HTMLDivElement>(null);
  const overlayDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
  } | null>(null);
  const [overlayToolbarPos, setOverlayToolbarPos] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const clampOverlayToolbarPos = useCallback((left: number, top: number) => {
    const panel = overlayToolbarRef.current;
    const parent = panel?.offsetParent as HTMLElement | null;
    if (!panel || !parent) return { left, top };
    const maxLeft = Math.max(0, parent.clientWidth - panel.offsetWidth);
    const maxTop = Math.max(0, parent.clientHeight - panel.offsetHeight);
    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop),
    };
  }, []);

  function handleOverlayToolbarPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return;
    const panel = overlayToolbarRef.current;
    const parent = panel?.offsetParent as HTMLElement | null;
    if (!panel || !parent) return;
    event.preventDefault();
    event.stopPropagation();
    const panelRect = panel.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const left = overlayToolbarPos?.left ?? panelRect.left - parentRect.left;
    const top = overlayToolbarPos?.top ?? panelRect.top - parentRect.top;
    const next = clampOverlayToolbarPos(left, top);
    setOverlayToolbarPos(next);
    overlayDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: next.left,
      origTop: next.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleOverlayToolbarPointerMove(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    const drag = overlayDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setOverlayToolbarPos(
      clampOverlayToolbarPos(
        drag.origLeft + (event.clientX - drag.startX),
        drag.origTop + (event.clientY - drag.startY),
      ),
    );
  }

  function handleOverlayToolbarPointerUp(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    const drag = overlayDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    overlayDragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div
        ref={overlayToolbarRef}
        className={cn(
          "pointer-events-auto absolute flex max-w-[calc(100%-1rem)] items-start gap-1 rounded-lg border bg-background/95 p-1.5 shadow-sm backdrop-blur-sm",
          overlayToolbarPos == null && "top-2 left-1/2 -translate-x-1/2",
        )}
        style={
          overlayToolbarPos
            ? {
                left: overlayToolbarPos.left,
                top: overlayToolbarPos.top,
              }
            : undefined
        }
      >
        <button
          type="button"
          aria-label="Drag field toolbar"
          title="Drag to move toolbar"
          className="mt-0.5 inline-flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          onPointerDown={handleOverlayToolbarPointerDown}
          onPointerMove={handleOverlayToolbarPointerMove}
          onPointerUp={handleOverlayToolbarPointerUp}
          onPointerCancel={handleOverlayToolbarPointerUp}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
