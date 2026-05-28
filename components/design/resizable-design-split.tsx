"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "swarm-design-chat-height";
const DEFAULT_BOTTOM = 200;
const MIN_TOP = 200;
const MIN_BOTTOM = 140;
const HANDLE_HEIGHT = 10;

function readStoredHeight(): number {
  if (typeof window === "undefined") return DEFAULT_BOTTOM;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BOTTOM;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : DEFAULT_BOTTOM;
  } catch {
    return DEFAULT_BOTTOM;
  }
}

function clampBottom(bottom: number, containerHeight: number): number {
  const maxBottom = containerHeight - MIN_TOP - HANDLE_HEIGHT;
  return Math.min(Math.max(bottom, MIN_BOTTOM), Math.max(MIN_BOTTOM, maxBottom));
}

interface VerticalResizeHandleProps {
  onDrag: (deltaY: number) => void;
}

function VerticalResizeHandle({ onDrag }: VerticalResizeHandleProps) {
  const dragging = useRef(false);
  const lastY = useRef(0);
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!dragging.current) return;
      const delta = event.clientY - lastY.current;
      lastY.current = event.clientY;
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
      aria-orientation="horizontal"
      aria-label="Resize design edit panel"
      className="group relative z-10 flex h-2.5 shrink-0 cursor-row-resize items-center justify-center"
      onMouseDown={(event) => {
        dragging.current = true;
        lastY.current = event.clientY;
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
        event.preventDefault();
      }}
    >
      <div className="absolute inset-x-4 h-px bg-white/[0.06] transition-colors group-hover:bg-system/40 group-active:bg-system/60" />
      <div className="relative flex h-1 w-10 items-center justify-center gap-0.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100">
        <span className="size-0.5 rounded-full bg-white/30" />
        <span className="size-0.5 rounded-full bg-white/30" />
        <span className="size-0.5 rounded-full bg-white/30" />
      </div>
    </div>
  );
}

interface ResizableDesignSplitProps {
  top: ReactNode;
  bottom: ReactNode;
  className?: string;
}

export function ResizableDesignSplit({
  top,
  bottom,
  className,
}: ResizableDesignSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_BOTTOM);
  const bottomRef = useRef(bottomHeight);
  bottomRef.current = bottomHeight;

  const applyHeight = useCallback((next: number) => {
    const containerHeight = containerRef.current?.clientHeight ?? 0;
    if (containerHeight <= 0) {
      setBottomHeight(next);
      return;
    }
    setBottomHeight(clampBottom(next, containerHeight));
  }, []);

  useEffect(() => {
    applyHeight(readStoredHeight());
  }, [applyHeight]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(bottomHeight));
    } catch {
      // ignore
    }
  }, [bottomHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      applyHeight(bottomRef.current);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [applyHeight]);

  const resizeBottom = useCallback(
    (deltaY: number) => {
      applyHeight(bottomRef.current - deltaY);
    },
    [applyHeight]
  );

  return (
    <div
      ref={containerRef}
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      <div className="min-h-0 flex-1 overflow-hidden">{top}</div>
      <VerticalResizeHandle onDrag={resizeBottom} />
      <div
        className="shrink-0 overflow-hidden"
        style={{ height: `${bottomHeight}px` }}
      >
        {bottom}
      </div>
    </div>
  );
}
