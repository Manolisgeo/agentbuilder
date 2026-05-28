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
        "pointer-events-auto absolute left-4 right-4 top-3 z-20 flex items-center justify-between gap-3 rounded-full border border-black/[0.07] bg-white/80 px-3 py-1.5 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#16141a]/85 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)]",
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-1">
        <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary/30 to-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Workflow className="size-3 text-primary" strokeWidth={2.4} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-foreground">
            {agentName ?? "Workflow canvas"}
          </span>
          {nodeCount > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              · {nodeCount} node{nodeCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {isBuilding && (
          <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-primary">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
              <span className="relative size-1.5 rounded-full bg-primary" />
            </span>
            Assembling
          </span>
        )}
        {onFitView && (
          <button
            type="button"
            onClick={onFitView}
            className="flex size-7 items-center justify-center rounded-full border border-black/[0.08] bg-black/[0.02] text-muted-foreground transition-all hover:border-black/[0.15] hover:bg-black/[0.06] hover:text-foreground dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-white/[0.15] dark:hover:bg-white/[0.06]"
            aria-label="Fit canvas to view"
          >
            <Maximize2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}
