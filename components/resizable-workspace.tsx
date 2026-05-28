"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "swarm-panel-widths";
const DEFAULT_LEFT = 360;
const DEFAULT_RIGHT = 300;
const MIN_LEFT = 280;
const MIN_RIGHT = 240;
const MIN_CENTER = 360;
const HANDLE_WIDTH = 12;

interface PanelWidths {
  left: number;
  right: number;
}

function readStoredWidths(): PanelWidths {
  if (typeof window === "undefined") {
    return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
    const parsed = JSON.parse(raw) as Partial<PanelWidths>;
    return {
      left: parsed.left ?? DEFAULT_LEFT,
      right: parsed.right ?? DEFAULT_RIGHT,
    };
  } catch {
    return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
  }
}

function clampWidths(
  widths: PanelWidths,
  containerWidth: number
): PanelWidths {
  const maxLeft = containerWidth - widths.right - MIN_CENTER - HANDLE_WIDTH * 2;
  const maxRight = containerWidth - widths.left - MIN_CENTER - HANDLE_WIDTH * 2;

  return {
    left: Math.min(Math.max(widths.left, MIN_LEFT), Math.max(MIN_LEFT, maxLeft)),
    right: Math.min(
      Math.max(widths.right, MIN_RIGHT),
      Math.max(MIN_RIGHT, maxRight)
    ),
  };
}

interface ResizeHandleProps {
  onDrag: (deltaX: number) => void;
  className?: string;
}

function ResizeHandle({ onDrag, className }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!dragging.current) return;
      const delta = event.clientX - lastX.current;
      lastX.current = event.clientX;
      onDragRef.current(delta);
    }

    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      className={cn(
        "group relative z-10 flex w-3 shrink-0 cursor-col-resize items-center justify-center",
        className
      )}
      onMouseDown={(event) => {
        dragging.current = true;
        lastX.current = event.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        event.preventDefault();
      }}
    >
      <div className="absolute inset-y-3 w-px bg-white/[0.04] transition-colors group-hover:bg-primary/40 group-active:bg-primary/60" />
      <div className="relative flex h-8 w-1 flex-col items-center justify-center gap-0.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100">
        <span className="size-0.5 rounded-full bg-white/30" />
        <span className="size-0.5 rounded-full bg-white/30" />
        <span className="size-0.5 rounded-full bg-white/30" />
      </div>
    </div>
  );
}

interface ResizableWorkspaceProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
}

export function ResizableWorkspace({
  left,
  center,
  right,
  className,
}: ResizableWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<PanelWidths>({
    left: DEFAULT_LEFT,
    right: DEFAULT_RIGHT,
  });
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const applyWidths = useCallback((next: PanelWidths) => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    if (containerWidth <= 0) {
      setWidths(next);
      return;
    }
    setWidths(clampWidths(next, containerWidth));
  }, []);

  useEffect(() => {
    applyWidths(readStoredWidths());
  }, [applyWidths]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch {
      // ignore storage errors
    }
  }, [widths]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      applyWidths(widthsRef.current);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [applyWidths]);

  const resizeLeft = useCallback(
    (deltaX: number) => {
      applyWidths({
        left: widthsRef.current.left + deltaX,
        right: widthsRef.current.right,
      });
    },
    [applyWidths]
  );

  const resizeRight = useCallback(
    (deltaX: number) => {
      applyWidths({
        left: widthsRef.current.left,
        right: widthsRef.current.right - deltaX,
      });
    },
    [applyWidths]
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      {/* Desktop: draggable columns */}
      <div
        ref={containerRef}
        className={cn(
          "hidden h-full min-h-0 w-full overflow-hidden lg:flex",
          className
        )}
      >
        <div
          className="panel-enter flex h-full min-h-0 shrink-0 flex-col"
          style={{ width: `${widths.left}px`, animationDelay: "80ms" }}
        >
          {left}
        </div>

        <ResizeHandle onDrag={resizeLeft} />

        <div
          className="panel-enter flex h-full min-h-0 min-w-0 flex-1 flex-col"
          style={{ animationDelay: "160ms" }}
        >
          {center}
        </div>

        <ResizeHandle onDrag={resizeRight} />

        <div
          className="panel-enter flex h-full min-h-0 shrink-0 flex-col"
          style={{ width: `${widths.right}px`, animationDelay: "240ms" }}
        >
          {right}
        </div>
      </div>

      {/* Mobile / tablet: stacked */}
      <div
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto lg:hidden",
          className
        )}
      >
        <div className="panel-enter flex min-h-[420px] shrink-0 flex-col">
          {left}
        </div>
        <div className="panel-enter flex min-h-[420px] shrink-0 flex-col">
          {center}
        </div>
        <div className="panel-enter flex min-h-[420px] shrink-0 flex-col">
          {right}
        </div>
      </div>
    </div>
  );
}
