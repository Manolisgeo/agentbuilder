"use client";

import { Maximize2, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

interface BoardToolbarProps {
  agentName?: string;
  nodeCount: number;
  isBuilding?: boolean;
  onFitView?: () => void;
  className?: string;
}

export function BoardToolbar({
  agentName,
  nodeCount,
  isBuilding,
  onFitView,
  className,
}: BoardToolbarProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-surface-1/90 px-4 py-2 backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-surface-2">
          <Workflow className="size-3.5 text-primary" strokeWidth={2} />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">Workflow canvas</p>
          <p className="text-[10px] text-muted-foreground">
            {agentName ?? "Untitled workflow"}
            {nodeCount > 0 && ` · ${nodeCount} node${nodeCount === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isBuilding && (
          <span className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            Assembling
          </span>
        )}
        {onFitView && (
          <button
            type="button"
            onClick={onFitView}
            className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-surface-2 text-muted-foreground transition-colors hover:border-white/15 hover:text-foreground"
            aria-label="Fit canvas to view"
          >
            <Maximize2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
