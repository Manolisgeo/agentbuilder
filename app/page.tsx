"use client";

import { useCallback, useState } from "react";
import { ActionsPanel } from "@/components/actions-panel";
import { AgentGraph } from "@/components/agent-graph";
import { ChatPanel } from "@/components/chat-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { defaultAgentSpec, type AgentSpec } from "@/lib/agent-spec";

export default function Home() {
  const [agentSpec, setAgentSpec] = useState<AgentSpec>(defaultAgentSpec);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSpecUpdate = useCallback((spec: AgentSpec) => {
    setAgentSpec(spec);
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col bg-background">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Swarm</h1>
            <p className="text-xs text-muted-foreground">
              Conversational AI agent builder
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            Layer 1 · Build &amp; Export
          </span>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[360px_1fr_320px]">
          <ChatPanel
            agentSpec={agentSpec}
            onSpecUpdate={handleSpecUpdate}
            onError={setErrorMessage}
          />
          <AgentGraph spec={agentSpec} />
          <ActionsPanel
            agentSpec={agentSpec}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
          />
        </main>
      </div>
    </ErrorBoundary>
  );
}
