"use client";

import { useCallback, useMemo, useState } from "react";
import { ActionsPanel } from "@/components/actions-panel";
import { CenterPanel, type CenterView } from "@/components/center-panel";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { SegmentedProgress } from "@/components/hud/segmented-progress";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  computeBuildProgress,
  getBuildStatusLabel,
} from "@/lib/build-progress";
import { defaultAgentSpec, isAgentSpecEmpty, type AgentSpec } from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";

export default function Home() {
  const [agentSpec, setAgentSpec] = useState<AgentSpec>(defaultAgentSpec);
  const [buildPhase, setBuildPhase] = useState<BuildPhase>("discovery");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [centerView, setCenterView] = useState<CenterView>("canvas");

  const handleSpecUpdate = useCallback((spec: AgentSpec) => {
    setAgentSpec(spec);
  }, []);

  const buildProgress = useMemo(
    () => computeBuildProgress(agentSpec),
    [agentSpec]
  );
  const hasAgent = !isAgentSpecEmpty(agentSpec);
  const statusLabel = getBuildStatusLabel(
    buildProgress,
    isBuilding,
    hasAgent,
    buildPhase
  );

  return (
    <ErrorBoundary>
      <div className="hud-canvas flex h-screen overflow-hidden">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative shrink-0 border-b border-white/[0.06] bg-surface-1/80 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="hud-label mb-1">Swarm · Agent builder</p>
                <h1 className="text-lg font-medium tracking-tight text-foreground">
                  Build AI agents that work for you
                </h1>
              </div>

              <div className="hidden w-56 sm:block">
                <SegmentedProgress
                  value={buildProgress}
                  statusLabel={statusLabel}
                  compact
                />
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <span className="size-1.5 rounded-full bg-system idle-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {hasAgent ? agentSpec.name : "No agent"}
                </span>
              </div>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[minmax(320px,380px)_1fr_minmax(260px,280px)]">
            <ChatPanel
              agentSpec={agentSpec}
              buildPhase={buildPhase}
              onBuildPhaseChange={setBuildPhase}
              onSpecUpdate={handleSpecUpdate}
              onError={setErrorMessage}
              onBuildingChange={setIsBuilding}
            />
            <CenterPanel
              view={centerView}
              onViewChange={setCenterView}
              agentSpec={agentSpec}
              isBuilding={isBuilding}
              buildProgress={buildProgress}
              buildPhase={buildPhase}
            />
            <ActionsPanel
              agentSpec={agentSpec}
              errorMessage={errorMessage}
              onClearError={() => setErrorMessage(null)}
              buildProgress={buildProgress}
              statusLabel={statusLabel}
              isBuilding={isBuilding}
              onPreview={() => setCenterView("preview")}
            />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
