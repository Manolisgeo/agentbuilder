"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { CodegenActionsPanel } from "@/components/codegen-actions-panel";
import { CodegenChatPanel } from "@/components/codegen-chat-panel";
import { CodegenGraph } from "@/components/codegen-graph";
import { ErrorBoundary } from "@/components/error-boundary";
import { defaultCodeSpec, type CodeSpec } from "@/lib/codegen-types";

export default function AgentsPage() {
  const [codeSpec, setCodeSpec] = useState<CodeSpec>(defaultCodeSpec);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [lastCode, setLastCode] = useState("");

  return (
    <ErrorBoundary>
      <div className="hud-canvas flex h-screen overflow-hidden">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative shrink-0 border-b border-white/[0.06] bg-surface-1/80 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="hud-label mb-1">Code · Agent generator</p>
                <h1 className="text-lg font-medium tracking-tight text-foreground">
                  Generate Python agent scripts
                </h1>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <span className="size-1.5 rounded-full bg-system idle-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {codeSpec.nodes.length > 0 ? codeSpec.name : "No script"}
                </span>
              </div>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[minmax(300px,340px)_1fr_minmax(260px,280px)]">
            <CodegenChatPanel
              codeSpec={codeSpec}
              onSpecUpdate={setCodeSpec}
              onError={setErrorMessage}
              onBuildingChange={setIsBuilding}
              onCodeUpdate={setLastCode}
            />
            <CodegenGraph spec={codeSpec} isBuilding={isBuilding} />
            <CodegenActionsPanel
              codeSpec={codeSpec}
              lastCode={lastCode}
              errorMessage={errorMessage}
              onClearError={() => setErrorMessage(null)}
              isBuilding={isBuilding}
            />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
