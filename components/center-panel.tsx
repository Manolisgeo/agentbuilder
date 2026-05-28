"use client";

import { LayoutGrid, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentGraph } from "@/components/agent-graph";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { isAgentPreviewReady } from "@/lib/agent-prompt";
import type { AgentSpec } from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import type { MemoryWriteEvent, SwarmMemoryState } from "@/lib/swarm-memory";

export type CenterView = "canvas" | "preview";

interface CenterPanelProps {
  view: CenterView;
  onViewChange: (view: CenterView) => void;
  agentSpec: AgentSpec;
  isBuilding?: boolean;
  buildProgress?: number;
  buildPhase?: BuildPhase;
  memoryState?: SwarmMemoryState;
  onMemoryUpdate?: (event: MemoryWriteEvent) => void;
}

export function CenterPanel({
  view,
  onViewChange,
  agentSpec,
  isBuilding,
  buildProgress,
  buildPhase,
  memoryState,
  onMemoryUpdate,
}: CenterPanelProps) {
  const canPreview = isAgentPreviewReady(agentSpec);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative flex shrink-0 items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
        {/* Sliding active background */}
        <div
          className={cn(
            "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 ease-out",
            view === "canvas"
              ? "left-1 bg-gradient-to-br from-white/[0.07] to-white/[0.02] shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]"
              : "left-[calc(50%+0px)] bg-gradient-to-br from-violet/15 to-violet/[0.04] shadow-[0_2px_12px_-2px_rgba(139,92,246,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]"
          )}
        />

        <button
          type="button"
          onClick={() => onViewChange("canvas")}
          className={cn(
            "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[12px] font-medium transition-colors",
            view === "canvas"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid className="size-3.5" />
          Canvas
        </button>
        <button
          type="button"
          onClick={() => canPreview && onViewChange("preview")}
          disabled={!canPreview}
          title={
            canPreview
              ? "Preview your agent"
              : "Complete name, role, and instructions to preview"
          }
          className={cn(
            "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[12px] font-medium transition-colors",
            view === "preview"
              ? "text-violet-200"
              : "text-muted-foreground hover:text-foreground",
            !canPreview && "cursor-not-allowed opacity-40"
          )}
        >
          <Play className="size-3.5" />
          Preview
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {view === "canvas" ? (
          <AgentGraph
            spec={agentSpec}
            isBuilding={isBuilding}
            buildProgress={buildProgress}
            buildPhase={buildPhase}
            memoryState={memoryState}
          />
        ) : (
          <PreviewPanel
            key={JSON.stringify(agentSpec)}
            agentSpec={agentSpec}
            onMemoryUpdate={onMemoryUpdate}
          />
        )}
      </div>
    </div>
  );
}
