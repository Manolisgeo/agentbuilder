"use client";

import { useCallback, useMemo, useState } from "react";
import { Command } from "lucide-react";
import { ActionsPanel } from "@/components/actions-panel";
import { CenterPanel, type CenterView } from "@/components/center-panel";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { ResizableWorkspace } from "@/components/resizable-workspace";
import { ProgressRail } from "@/components/hud/progress-rail";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  computeBuildProgress,
  getBuildStatusLabel,
} from "@/lib/build-progress";
import {
  defaultAgentSpec,
  isAgentSpecEmpty,
  normalizeAgentSpec,
  type AgentSpec,
} from "@/lib/agent-spec";
import type { BuildPhase } from "@/lib/build-phase";
import type { MemoryWriteEvent, SwarmMemoryState } from "@/lib/swarm-memory";

export default function Home() {
  const [agentSpec, setAgentSpec] = useState<AgentSpec>(defaultAgentSpec);
  const [buildPhase, setBuildPhase] = useState<BuildPhase>("discovery");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [centerView, setCenterView] = useState<CenterView>("canvas");
  const [memoryState, setMemoryState] = useState<SwarmMemoryState>({});
  const [lastWrittenBy, setLastWrittenBy] = useState<Record<string, string>>({});
  const [latestWrittenKeys, setLatestWrittenKeys] = useState<Set<string>>(new Set());

  const handleSpecUpdate = useCallback((spec: AgentSpec) => {
    setAgentSpec((current) => normalizeAgentSpec(spec, current));
  }, []);

  const handleMemoryUpdate = useCallback((event: MemoryWriteEvent) => {
    setMemoryState(event.state);
    if (event.writes.length > 0) {
      setLastWrittenBy((prev) => {
        const next = { ...prev };
        for (const w of event.writes) {
          next[w.key] = w.agentRole;
        }
        return next;
      });
      setLatestWrittenKeys(new Set(event.writes.map((w) => w.key)));
      setTimeout(() => setLatestWrittenKeys(new Set()), 1200);
    }
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
      <div className="hud-canvas relative flex h-screen overflow-hidden">
        <ProgressRail value={buildProgress} />

        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="header-glow-in relative shrink-0 px-7 pt-5 pb-4">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/80">
                    Swarm
                  </span>
                  <span className="size-1 rounded-full bg-white/15" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60">
                    Workspace
                  </span>
                  <span className="size-1 rounded-full bg-white/15" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/70">
                    Agent builder
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 lg:flex">
                  <span
                    className={`size-1.5 rounded-full ${
                      isBuilding
                        ? "bg-primary shadow-[0_0_8px_rgba(255,107,26,0.8)]"
                        : hasAgent
                          ? "bg-success shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                          : "bg-system idle-pulse"
                    }`}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/80">
                    {statusLabel}
                  </span>
                  <span className="ml-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {buildProgress}%
                  </span>
                </div>

                <button
                  type="button"
                  className="lift hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-muted-foreground hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-foreground md:flex"
                  aria-label="Command palette"
                >
                  <Command className="size-3" strokeWidth={2} />
                  <span>Quick actions</span>
                  <kbd>⌘K</kbd>
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-end justify-between gap-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                <span className="text-foreground/95">Build </span>
                <span className="text-gradient-ember">AI agents</span>
                <span className="text-foreground/95"> that work for you</span>
              </h1>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5">
            <ResizableWorkspace
              left={
                <ChatPanel
                  agentSpec={agentSpec}
                  buildPhase={buildPhase}
                  onBuildPhaseChange={setBuildPhase}
                  onSpecUpdate={handleSpecUpdate}
                  onError={setErrorMessage}
                  onBuildingChange={setIsBuilding}
                />
              }
              center={
                <CenterPanel
                  view={centerView}
                  onViewChange={setCenterView}
                  agentSpec={agentSpec}
                  isBuilding={isBuilding}
                  buildProgress={buildProgress}
                  buildPhase={buildPhase}
                  memoryState={memoryState}
                  onMemoryUpdate={handleMemoryUpdate}
                />
              }
              right={
                <ActionsPanel
                  agentSpec={agentSpec}
                  errorMessage={errorMessage}
                  onClearError={() => setErrorMessage(null)}
                  buildProgress={buildProgress}
                  statusLabel={statusLabel}
                  isBuilding={isBuilding}
                  onPreview={() => setCenterView("preview")}
                  onDesign={() => setCenterView("design")}
                  onSpecUpdate={handleSpecUpdate}
                  memoryState={memoryState}
                  lastWrittenBy={lastWrittenBy}
                  latestWrittenKeys={latestWrittenKeys}
                />
              }
            />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
