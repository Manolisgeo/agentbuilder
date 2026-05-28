"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Command, User } from "lucide-react";
import { ActionsPanel } from "@/components/actions-panel";
import { CenterPanel, type CenterView } from "@/components/center-panel";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { ResizableWorkspace } from "@/components/resizable-workspace";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  computeBuildProgress,
  getBuildStatusLabel,
} from "@/lib/build-progress";
import {
  defaultAgentSpec,
  isAgentSpecEmpty,
  type AgentSpec,
} from "@/lib/agent-spec";
import { getAgent, type StoredAgent } from "@/lib/agent-storage";
import type { BuildPhase } from "@/lib/build-phase";
import type { MemoryWriteEvent, SwarmMemoryState } from "@/lib/swarm-memory";

export default function Home() {
  const [agentSpec, setAgentSpec] = useState<AgentSpec>(defaultAgentSpec);
  const [agentId, setAgentId] = useState<string | undefined>(undefined);
  const [buildPhase, setBuildPhase] = useState<BuildPhase>("discovery");

  // Load agent from library when navigating with ?id=
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    const stored = getAgent(id);
    if (stored) {
      setAgentSpec(stored.spec);
      setAgentId(stored.id);
      setBuildPhase("building");
    }
  }, []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [centerView, setCenterView] = useState<CenterView>("canvas");
  const [memoryState, setMemoryState] = useState<SwarmMemoryState>({});
  const [lastWrittenBy, setLastWrittenBy] = useState<Record<string, string>>({});
  const [latestWrittenKeys, setLatestWrittenKeys] = useState<Set<string>>(new Set());

  const handleSpecUpdate = useCallback((spec: AgentSpec) => {
    setAgentSpec(spec);
  }, []);

  const handleAgentSaved = useCallback((stored: StoredAgent) => {
    setAgentId(stored.id);
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
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="relative shrink-0 border-b border-black/[0.05] bg-white/40 px-7 pt-5 pb-4 backdrop-blur-sm dark:border-white/[0.04] dark:bg-transparent dark:backdrop-blur-none">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/80">
                    Swarm
                  </span>
                  <span className="size-1 rounded-full bg-black/20 dark:bg-white/15" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60">
                    Workspace
                  </span>
                  <span className="size-1 rounded-full bg-black/20 dark:bg-white/15" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/70">
                    Agent builder
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="hidden items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm hover:bg-muted hover:text-foreground md:flex"
                  aria-label="Command palette"
                >
                  <Command className="size-3" strokeWidth={2} />
                  <span>Quick actions</span>
                  <kbd className="ml-1 rounded border border-border bg-background px-1 font-mono text-[10px]">⌘K</kbd>
                </button>
                <ThemeToggle />
                <div className="relative ml-2">
                  <div className="flex size-9 items-center justify-center rounded-full border border-border bg-primary/10 text-primary">
                    <User className="size-4" strokeWidth={2} />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-success" />
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-end justify-between gap-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                <span className="text-foreground">Build </span>
                <span className="text-primary">AI agents</span>
                <span className="text-foreground"> that work for you</span>
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
                  agentId={agentId}
                  errorMessage={errorMessage}
                  onClearError={() => setErrorMessage(null)}
                  onAgentSaved={handleAgentSaved}
                  buildProgress={buildProgress}
                  statusLabel={statusLabel}
                  isBuilding={isBuilding}
                  onPreview={() => setCenterView("preview")}
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
