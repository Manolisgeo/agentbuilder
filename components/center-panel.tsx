"use client";

import { LayoutGrid, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentGraph } from "@/components/agent-graph";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { isAgentPreviewReady } from "@/lib/agent-prompt";
import type { AgentSpec } from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";

export type CenterView = "canvas" | "preview";

interface CenterPanelProps {
  view: CenterView;
  onViewChange: (view: CenterView) => void;
  agentSpec: AgentSpec;
  isBuilding?: boolean;
  buildProgress?: number;
  buildPhase?: BuildPhase;
}

export function CenterPanel({
  view,
  onViewChange,
  agentSpec,
  isBuilding,
  buildProgress,
  buildPhase,
}: CenterPanelProps) {
  const canPreview = isAgentPreviewReady(agentSpec);

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-2">
      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/[0.06] bg-surface-1 p-1">
        <button
          type="button"
          onClick={() => onViewChange("canvas")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            view === "canvas"
              ? "bg-surface-2 text-foreground shadow-sm"
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
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            view === "preview"
              ? "bg-violet-500/15 text-violet-200 shadow-sm"
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
          />
        ) : (
          <PreviewPanel key={JSON.stringify(agentSpec)} agentSpec={agentSpec} />
        )}
      </div>
    </div>
  );
}
