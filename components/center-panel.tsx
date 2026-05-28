"use client";

import { LayoutGrid, Palette, Play } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AgentGraph } from "@/components/agent-graph";
import { DesignPreviewPanel } from "@/components/design/design-preview-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { isAgentPreviewReady } from "@/lib/agent-prompt";
import { hasAgentFrontend } from "@/lib/deploy-html";
import type { AgentSpec } from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import type { MemoryWriteEvent, SwarmMemoryState } from "@/lib/swarm-memory";

export type CenterView = "canvas" | "preview" | "design";

interface CenterPanelProps {
  view: CenterView;
  onViewChange: (view: CenterView) => void;
  agentSpec: AgentSpec;
  isBuilding?: boolean;
  buildProgress?: number;
  buildPhase?: BuildPhase;
  memoryState?: SwarmMemoryState;
  onMemoryUpdate?: (event: MemoryWriteEvent) => void;
  onSpecUpdate?: (spec: AgentSpec) => void;
}

const VIEW_OPTIONS: {
  id: CenterView;
  label: string;
  icon: typeof LayoutGrid;
  requiresDesign?: boolean;
}[] = [
  { id: "canvas", label: "Canvas", icon: LayoutGrid },
  { id: "preview", label: "Preview", icon: Play, requiresDesign: true },
  { id: "design", label: "Design", icon: Palette },
];

export function CenterPanel({
  view,
  onViewChange,
  agentSpec,
  isBuilding,
  buildProgress,
  buildPhase,
  memoryState,
  onMemoryUpdate,
  onSpecUpdate,
}: CenterPanelProps) {
  const canPreview = isAgentPreviewReady(agentSpec);
  const hasFrontend = hasAgentFrontend(agentSpec);
  const activeIndex = VIEW_OPTIONS.findIndex((option) => option.id === view);
  const [mountedViews, setMountedViews] = useState<Set<CenterView>>(
    () => new Set(["canvas"])
  );

  useEffect(() => {
    setMountedViews((prev) => {
      if (prev.has(view)) return prev;
      const next = new Set(prev);
      next.add(view);
      return next;
    });
  }, [view]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative flex shrink-0 items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
        <div
          className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out"
          style={{
            width: `calc(${100 / VIEW_OPTIONS.length}% - 4px)`,
            left: `calc(${(activeIndex * 100) / VIEW_OPTIONS.length}% + 2px)`,
            background:
              view === "design"
                ? "linear-gradient(to bottom right, rgba(34,211,238,0.15), rgba(34,211,238,0.04))"
                : view === "preview"
                  ? "linear-gradient(to bottom right, rgba(139,92,246,0.15), rgba(139,92,246,0.04))"
                  : "linear-gradient(to bottom right, rgba(255,255,255,0.07), rgba(255,255,255,0.02))",
            boxShadow:
              view === "design"
                ? "0 2px 12px -2px rgba(34,211,238,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
                : view === "preview"
                  ? "0 2px 12px -2px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        />

        {VIEW_OPTIONS.map((option) => {
          const disabled =
            option.requiresDesign &&
            (!hasFrontend || !canPreview);
          const isActive = view === option.id;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                if (disabled) return;
                startTransition(() => onViewChange(option.id));
              }}
              disabled={disabled}
              title={
                disabled
                  ? hasFrontend
                    ? "Complete name, role, and instructions to preview"
                    : "Generate the frontend in Design before previewing"
                  : option.label
              }
              className={cn(
                "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-2 py-2 text-[12px] font-medium transition-colors",
                isActive
                  ? option.id === "design"
                    ? "text-system"
                    : option.id === "preview"
                      ? "text-violet-200"
                      : "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              <Icon className="size-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className={cn(
            "absolute inset-0 flex min-h-0 flex-col",
            view !== "canvas" && "hidden"
          )}
          aria-hidden={view !== "canvas"}
        >
          <AgentGraph
            spec={agentSpec}
            isBuilding={isBuilding}
            buildProgress={buildProgress}
            buildPhase={buildPhase}
            memoryState={memoryState}
          />
        </div>

        {mountedViews.has("design") && (
          <div
            className={cn(
              "absolute inset-0 flex min-h-0 flex-col",
              view !== "design" && "hidden"
            )}
            aria-hidden={view !== "design"}
          >
            <DesignPreviewPanel
              agentSpec={agentSpec}
              onSpecUpdate={onSpecUpdate}
              isActive={view === "design"}
            />
          </div>
        )}

        {mountedViews.has("preview") && (
          <div
            className={cn(
              "absolute inset-0 flex min-h-0 flex-col",
              view !== "preview" && "hidden"
            )}
            aria-hidden={view !== "preview"}
          >
            <PreviewPanel
              agentSpec={agentSpec}
              onMemoryUpdate={onMemoryUpdate}
              isActive={view === "preview"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
